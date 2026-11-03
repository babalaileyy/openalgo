"""Public USD-M trade stream, adapted to OpenAlgo's market-data bus."""

import json
import time

import websocket

from database.token_db import get_br_symbol
from utils import real_threading
from websocket_proxy.base_adapter import BaseBrokerWebSocketAdapter


class BinanceWebSocketAdapter(BaseBrokerWebSocketAdapter):
    """One reconnecting socket per existing OpenAlgo connection-pool adapter."""

    URL = "wss://fstream.binance.com/market/ws"

    def __init__(self):
        super().__init__()
        self._lock = real_threading.Lock()
        self._stop = real_threading.Event()
        self._thread = None
        self._ws = None

    def initialize(self, broker_name, user_id, auth_data=None):
        self.broker_name = broker_name
        self.user_id = user_id

    def connect(self):
        with self._lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop.clear()
            self._thread = real_threading.Thread(target=self._run, name="binance-market", daemon=True)
            self._thread.start()

    def disconnect(self):
        self._stop.set()
        with self._lock:
            ws, thread = self._ws, self._thread
            self.subscriptions.clear()
        try:
            if ws:
                ws.close()
        finally:
            if thread:
                real_threading.join(thread, timeout=7)
            self.connected = False
            self.cleanup_zmq()

    def subscribe(self, symbol, exchange, mode=2, depth_level=5):
        if exchange != "CRYPTO" or mode != 1:
            return self._create_error_response("UNSUPPORTED", "Only LTP streams are supported")
        native = get_br_symbol(symbol, exchange)
        if not native:
            return self._create_error_response("SYMBOL_NOT_FOUND", f"Symbol not found: {symbol}")
        with self._lock:
            self.subscriptions[(symbol, exchange, mode)] = native.upper()
        return self._create_success_response("Subscription requested", symbol=symbol,
                                             exchange=exchange, mode=mode)

    def unsubscribe(self, symbol, exchange, mode=2):
        with self._lock:
            self.subscriptions.pop((symbol, exchange, mode), None)
        return self._create_success_response("Subscription removed", symbol=symbol,
                                             exchange=exchange, mode=mode)

    def _run(self):
        while not self._stop.is_set():
            ws = None
            try:
                ws = websocket.create_connection(self.URL, timeout=5, enable_multithread=True)
                ws.settimeout(0.2)
                with self._lock:
                    if self._stop.is_set():
                        break
                    self._ws = ws
                    self.connected = True
                active = set()
                request_id = 0
                next_send = 0.0
                while not self._stop.is_set():
                    with self._lock:
                        desired = {native.lower() + "@aggTrade" for native in self.subscriptions.values()}
                    if time.monotonic() >= next_send:
                        remove = sorted(active - desired)[:200]
                        add = sorted(desired - active)[:200] if not remove else []
                        if remove or add:
                            request_id += 1
                            ws.send(json.dumps({"method": "UNSUBSCRIBE" if remove else "SUBSCRIBE",
                                                "params": remove or add, "id": request_id}))
                            active.difference_update(remove)
                            active.update(add)
                            next_send = time.monotonic() + 0.25
                    try:
                        message = ws.recv()
                    except websocket.WebSocketTimeoutException:
                        continue
                    if not message:
                        break
                    self._on_message(message)
            except Exception:
                if not self._stop.is_set():
                    self.logger.exception("Binance market stream disconnected")
            finally:
                with self._lock:
                    if self._ws is ws:
                        self._ws = None
                        self.connected = False
                if ws:
                    ws.close()
            if not self._stop.is_set():
                real_threading.wait_for(self._stop, 2)

    def _on_message(self, raw):
        try:
            data = json.loads(raw)
            if data.get("e") != "aggTrade":
                if "code" in data:
                    raise RuntimeError(f"Binance stream rejected request: {data}")
                return
            native = data["s"]
            price, quantity = float(data["p"]), float(data["q"])
            timestamp = int(data["T"])
            with self._lock:
                matches = [(key, value) for key, value in self.subscriptions.items() if value == native]
            for (symbol, exchange, mode), _ in matches:
                self.publish_market_data(f"{exchange}_{symbol}_LTP", {
                    "symbol": symbol, "exchange": exchange, "mode": mode,
                    "timestamp": timestamp, "ltp": price, "ltq": quantity,
                })
        except (KeyError, TypeError, ValueError):
            self.logger.warning("Invalid Binance market stream message")
