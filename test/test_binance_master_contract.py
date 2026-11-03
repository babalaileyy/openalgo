import importlib.util
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def module():
    symbol = types.ModuleType("database.symbol")
    symbol.SymToken = object()
    symbol.db_session = MagicMock()
    extensions = types.ModuleType("extensions")
    extensions.socketio = MagicMock()
    http = types.ModuleType("utils.httpx_client")
    http.get_httpx_client = MagicMock()
    with patch.dict(sys.modules, {"database.symbol": symbol, "extensions": extensions,
                                  "utils.httpx_client": http}):
        spec = importlib.util.spec_from_file_location(
            "binance_master_test", Path("broker/binance/database/master_contract_db.py")
        )
        loaded = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(loaded)
        yield loaded


def contract(**overrides):
    row = {"symbol": "BTCUSDT", "baseAsset": "BTC", "quoteAsset": "USDT",
           "marginAsset": "USDT", "contractType": "PERPETUAL", "status": "TRADING",
           "filters": [{"filterType": "PRICE_FILTER", "tickSize": "0.10"}]}
    return row | overrides


def test_only_active_usdt_perpetuals_are_imported(module):
    rows = module.process_exchange_info({"symbols": [contract(),
        contract(symbol="ETHUSDC", quoteAsset="USDC"),
        contract(symbol="ETHUSDT", status="BREAK"),
        contract(symbol="BTCUSDT_240628", contractType="CURRENT_QUARTER")]})
    assert len(rows) == 1
    assert (rows[0]["symbol"], rows[0]["brsymbol"], rows[0]["tick_size"]) == (
        "BTCUSDT.P", "BTCUSDT", 0.1)


def test_invalid_download_does_not_replace_contracts(module):
    module.get_httpx_client.return_value.get.return_value.json.return_value = {"symbols": []}
    with pytest.raises(ValueError, match="No active"):
        module.master_contract_download()
    module.db_session.query.assert_not_called()
    module.db_session.remove.assert_called_once()
    assert module.socketio.emit.call_args.args[1]["status"] == "error"


def test_failed_insert_rolls_back(module):
    module.get_httpx_client.return_value.get.return_value.json.return_value = {
        "symbols": [contract()]}
    module.db_session.bulk_insert_mappings.side_effect = RuntimeError("insert failed")
    with pytest.raises(RuntimeError, match="insert failed"):
        module.master_contract_download()
    module.db_session.rollback.assert_called_once()
    module.db_session.commit.assert_not_called()
    module.db_session.remove.assert_called_once()
    assert module.socketio.emit.call_args.args[1]["status"] == "error"
