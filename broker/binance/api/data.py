"""Binance USD-M perpetual history for OpenAlgo's existing broker interface."""

from datetime import date, datetime, time, timedelta

import pandas as pd
import pytz

from database.token_db import get_br_symbol
from utils.httpx_client import get_httpx_client


class BrokerData:
    TIMEFRAME_MAP = {
        "1m": "1m",
        "3m": "3m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "2h": "2h",
        "4h": "4h",
        "6h": "6h",
        "8h": "8h",
        "12h": "12h",
        "D": "1d",
        "W": "1w",
        "M": "1M",
    }

    def __init__(self, auth_token):
        self.timeframe_map = self.TIMEFRAME_MAP

    def get_quotes(self, symbol, exchange):
        if exchange != "CRYPTO":
            raise ValueError("Unsupported exchange")
        native_symbol = get_br_symbol(symbol, exchange)
        if not native_symbol:
            raise ValueError("Symbol not found in the master contract")
        client = get_httpx_client()
        ticker = client.get(
            "https://fapi.binance.com/fapi/v1/ticker/24hr",
            params={"symbol": native_symbol}, timeout=15.0,
        )
        ticker.raise_for_status()
        data = ticker.json()
        book = client.get(
            "https://fapi.binance.com/fapi/v1/ticker/bookTicker",
            params={"symbol": native_symbol}, timeout=15.0,
        )
        book.raise_for_status()
        best = book.json()
        return {
            "ltp": float(data["lastPrice"]), "open": float(data["openPrice"]),
            "high": float(data["highPrice"]), "low": float(data["lowPrice"]),
            "volume": float(data["volume"]), "prev_close": float(data["openPrice"]),
            "oi": 0, "bid": float(best["bidPrice"]), "ask": float(best["askPrice"]),
        }

    def get_history(self, symbol, exchange, interval, start_date, end_date):
        if exchange != "CRYPTO" or interval not in self.TIMEFRAME_MAP:
            raise ValueError("Unsupported exchange or interval")
        native_symbol = get_br_symbol(symbol, exchange)
        if not native_symbol:
            raise ValueError("Symbol not found in the master contract")
        start = start_date if isinstance(start_date, date) else date.fromisoformat(start_date)
        end = end_date if isinstance(end_date, date) else date.fromisoformat(end_date)
        if end < start:
            raise ValueError("End date precedes start date")
        # The common OpenAlgo history API uses IST calendar dates; timestamps
        # returned to its clients are UTC epoch seconds.
        zone = pytz.timezone("Asia/Kolkata")
        cursor = int(zone.localize(datetime.combine(start, time.min)).timestamp() * 1000)
        end_ms = int(
            zone.localize(datetime.combine(end + timedelta(days=1), time.min)).timestamp() * 1000
        )
        records = []
        while cursor < end_ms:
            # Also pace subsequent pages through the common broker history gate.
            from services.history_service import _enforce_rate_limit

            _enforce_rate_limit()
            response = get_httpx_client().get(
                "https://fapi.binance.com/fapi/v1/klines",
                params={
                    "symbol": native_symbol,
                    "interval": self.TIMEFRAME_MAP[interval],
                    "startTime": cursor,
                    "endTime": end_ms - 1,
                    "limit": 1000,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list):
                raise ValueError("Unexpected Binance candle response")
            if not rows:
                break
            last = cursor - 1
            for row in rows:
                if not isinstance(row, list) or len(row) < 6:
                    raise ValueError("Invalid Binance candle")
                stamp = int(row[0])
                if cursor <= stamp < end_ms:
                    records.append(
                        {
                            "timestamp": stamp // 1000,
                            "open": float(row[1]),
                            "high": float(row[2]),
                            "low": float(row[3]),
                            "close": float(row[4]),
                            "volume": float(row[5]),
                            "oi": 0,
                        }
                    )
                last = max(last, stamp)
            if last < cursor:
                raise ValueError("Binance history page did not advance")
            cursor = last + 1
            if len(rows) < 1000:
                break
        frame = pd.DataFrame(
            records, columns=["timestamp", "open", "high", "low", "close", "volume", "oi"]
        )
        return (
            frame.drop_duplicates(subset=["timestamp"])
            .sort_values("timestamp")
            .reset_index(drop=True)
        )
