import json
from unittest.mock import MagicMock

import pytest

from broker.binance.streaming import binance_adapter


@pytest.fixture
def adapter(monkeypatch):
    def initialize_base(self):
        self.subscriptions = {}
        self.connected = False
        self.logger = MagicMock()

    monkeypatch.setattr(binance_adapter.BaseBrokerWebSocketAdapter, "__init__", initialize_base)
    monkeypatch.setattr(binance_adapter, "get_br_symbol", lambda symbol, exchange: "BTCUSDT")
    instance = binance_adapter.BinanceWebSocketAdapter()
    instance.publish_market_data = MagicMock()
    instance.cleanup_zmq = MagicMock()
    return instance


def test_trade_is_published_and_unsubscribe_stops_updates(adapter):
    adapter.subscribe("BTCUSDT.P", "CRYPTO", 1)
    assert adapter.subscribe("BTCUSDT.P", "CRYPTO", 2)["status"] == "error"
    adapter._on_message(json.dumps({"e": "aggTrade", "s": "BTCUSDT", "p": "123.5",
                                    "q": "0.001", "T": 1700000000123}))
    calls = adapter.publish_market_data.call_args_list
    assert [call.args[0] for call in calls] == ["CRYPTO_BTCUSDT.P_LTP"]
    assert calls[0].args[1]["ltq"] == 0.001
    assert calls[0].args[1]["timestamp"] == 1700000000123
    adapter.unsubscribe("BTCUSDT.P", "CRYPTO", 1)
    adapter.publish_market_data.reset_mock()
    adapter._on_message(json.dumps({"e": "aggTrade", "s": "BTCUSDT", "p": "123.5",
                                    "q": "0.001", "T": 1700000000123}))
    adapter.publish_market_data.assert_not_called()


def test_rejected_subscriptions_force_reconnect(adapter):
    with pytest.raises(RuntimeError, match="rejected"):
        adapter._on_message('{"code":2,"msg":"Invalid request"}')


def test_disconnect_closes_socket_and_clears_subscriptions(adapter):
    adapter.subscribe("BTCUSDT.P", "CRYPTO", 1)
    adapter._ws = MagicMock()
    ws = adapter._ws
    adapter.disconnect()
    ws.close.assert_called_once()
    assert not adapter.subscriptions
    adapter.cleanup_zmq.assert_called_once()


def test_reconnect_resubscribes_and_closes_each_socket(adapter, monkeypatch):
    adapter.subscribe("BTCUSDT.P", "CRYPTO", 1)
    sockets = []

    class Socket:
        def __init__(self):
            self.sent = []
            self.closed = False

        def settimeout(self, _timeout):
            pass

        def send(self, message):
            self.sent.append(json.loads(message))

        def recv(self):
            if len(sockets) == 1:
                raise ConnectionError("disconnected")
            adapter._stop.set()
            return ""

        def close(self):
            self.closed = True

    def connect(*args, **kwargs):
        socket = Socket()
        sockets.append(socket)
        return socket

    monkeypatch.setattr(binance_adapter.websocket, "create_connection", connect)
    monkeypatch.setattr(binance_adapter.real_threading, "wait_for", lambda *_: None)
    adapter._run()
    assert len(sockets) == 2
    assert all(socket.closed for socket in sockets)
    assert all(socket.sent[0]["params"] == ["btcusdt@aggTrade"] for socket in sockets)
    assert not adapter.connected
