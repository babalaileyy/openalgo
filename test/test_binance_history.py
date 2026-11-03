import importlib.util
import sys
import types
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pandas  # Load native dependencies before patching sys.modules.


class Response:
    def __init__(self, rows):
        self.rows = rows

    def raise_for_status(self):
        pass

    def json(self):
        return self.rows


class Client:
    def __init__(self, pages):
        self.pages = iter(pages)
        self.calls = []

    def get(self, url, params, timeout):
        self.calls.append((url, params, timeout))
        return Response(next(self.pages))


class BinanceHistoryTest(unittest.TestCase):
    def load(self, client):
        token = types.ModuleType("database.token_db")
        token.get_br_symbol = lambda symbol, exchange: "BTCUSDT" if symbol == "BTCUSDT" else None
        http = types.ModuleType("utils.httpx_client")
        http.get_httpx_client = lambda: client
        history = types.ModuleType("services.history_service")
        history._enforce_rate_limit = lambda: None
        modules = {
            "database.token_db": token,
            "utils.httpx_client": http,
            "services.history_service": history,
        }
        self.patcher = patch.dict(sys.modules, modules)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        spec = importlib.util.spec_from_file_location(
            "binance_data_test", Path("broker/binance/api/data.py")
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.BrokerData(None)

    def test_history_resolves_symbol_and_preserves_fractional_volume(self):
        client = Client([[[1704047400000, "1", "3", "0.5", "2", "0.001"]]])
        frame = self.load(client).get_history("BTCUSDT", "CRYPTO", "1m", "2024-01-01", "2024-01-01")
        self.assertEqual(frame.iloc[0]["volume"], 0.001)
        self.assertEqual(frame.iloc[0]["timestamp"], 1704047400)
        self.assertEqual(client.calls[0][1]["symbol"], "BTCUSDT")
        self.assertEqual(client.calls[0][1]["startTime"], 1704047400000)

    def test_history_accepts_dates_from_history_service(self):
        client = Client([[[1704047400000, "1", "3", "0.5", "2", "0.001"]]])
        frame = self.load(client).get_history(
            "BTCUSDT", "CRYPTO", "5m", date(2024, 1, 1), date(2024, 1, 1)
        )
        self.assertEqual(len(frame), 1)
        self.assertEqual(client.calls[0][1]["startTime"], 1704047400000)

    def test_invalid_inputs_do_not_request_exchange(self):
        client = Client([])
        broker = self.load(client)
        for args in [
            ("BAD", "CRYPTO", "1m", "2024-01-01", "2024-01-01"),
            ("BTCUSDT", "NSE", "1m", "2024-01-01", "2024-01-01"),
            ("BTCUSDT", "CRYPTO", "7m", "2024-01-01", "2024-01-01"),
        ]:
            with self.assertRaises(ValueError):
                broker.get_history(*args)
        self.assertEqual(client.calls, [])

    def test_quotes_use_24_hour_ticker_and_book(self):
        client = Client([{"lastPrice": "11", "openPrice": "10", "highPrice": "12",
                          "lowPrice": "9", "volume": "0.01"},
                         {"bidPrice": "10.9", "askPrice": "11.1"}])
        result = self.load(client).get_quotes("BTCUSDT", "CRYPTO")
        self.assertEqual((result["ltp"], result["volume"], result["bid"], result["ask"]),
                         (11, 0.01, 10.9, 11.1))
        self.assertEqual([c[1]["symbol"] for c in client.calls], ["BTCUSDT", "BTCUSDT"])

    def test_pagination_advances_without_duplicate_bars(self):
        start = 1704047400000
        first = [[start + i * 60000, "1", "3", "0.5", "2", "0.001"] for i in range(1000)]
        second = [[start + 1000 * 60000, "1", "3", "0.5", "2", "0.001"]]
        client = Client([first, second])
        frame = self.load(client).get_history("BTCUSDT", "CRYPTO", "1m", "2024-01-01", "2024-01-01")
        self.assertEqual(len(frame), 1001)
        self.assertEqual(client.calls[1][1]["startTime"], first[-1][0] + 1)

    def test_stalled_page_is_rejected(self):
        start = 1704047400000
        first = [[start + i * 60000, "1", "3", "0.5", "2", "1"] for i in range(1000)]
        client = Client([first, first])
        with self.assertRaisesRegex(ValueError, "did not advance"):
            self.load(client).get_history("BTCUSDT", "CRYPTO", "1m", "2024-01-01", "2024-01-01")
