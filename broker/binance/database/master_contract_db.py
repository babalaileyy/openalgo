"""Binance USD-M perpetuals in the existing OpenAlgo master contract."""

from database.symbol import SymToken, db_session
from extensions import socketio
from utils.httpx_client import get_httpx_client
from utils.logging import get_logger

logger = get_logger(__name__)


def process_exchange_info(payload):
    """Translate active USDT-settled perpetual contracts to common symbols."""
    if not isinstance(payload, dict) or not isinstance(payload.get("symbols"), list):
        raise ValueError("Invalid exchange information")
    result = []
    seen = set()
    for item in payload["symbols"]:
        if not isinstance(item, dict):
            raise ValueError("Invalid contract information")
        if (item.get("contractType") != "PERPETUAL" or item.get("status") != "TRADING"
                or item.get("quoteAsset") != "USDT" or item.get("marginAsset") != "USDT"):
            continue
        symbol = item.get("symbol")
        base = item.get("baseAsset")
        filters = item.get("filters")
        if not isinstance(symbol, str) or not symbol or not isinstance(base, str) or not base:
            raise ValueError("Contract is missing its symbol or base asset")
        if not isinstance(filters, list):
            raise ValueError("Contract is missing price filters")
        price_filter = next((f for f in filters if f.get("filterType") == "PRICE_FILTER"), None)
        if price_filter is None:
            raise ValueError("Contract is missing its price filter")
        tick_size = float(price_filter["tickSize"])
        if tick_size <= 0 or symbol in seen:
            raise ValueError("Invalid or duplicate contract")
        seen.add(symbol)
        result.append({
            "symbol": symbol + ".P", "brsymbol": symbol, "name": base,
            "exchange": "CRYPTO", "brexchange": "CRYPTO", "token": symbol,
            "expiry": "", "strike": 0.0, "lotsize": 1,
            "instrumenttype": "PERPFUT", "tick_size": tick_size, "contract_value": 1.0,
        })
    if not result:
        raise ValueError("No active USDT perpetual contracts returned")
    return result


def master_contract_download():
    """Fetch before replacing the existing contract table, in one transaction."""
    try:
        response = get_httpx_client().get(
            "https://fapi.binance.com/fapi/v1/exchangeInfo", timeout=15.0
        )
        response.raise_for_status()
        contracts = process_exchange_info(response.json())
        try:
            db_session.query(SymToken).delete(synchronize_session=False)
            db_session.bulk_insert_mappings(SymToken, contracts)
            db_session.commit()
        except Exception:
            db_session.rollback()
            raise
        return socketio.emit("master_contract_download", {
            "status": "success", "message": f"Successfully downloaded {len(contracts)} instruments"
        })
    except Exception as exc:
        logger.exception("Binance master contract download failed")
        socketio.emit("master_contract_download", {"status": "error", "message": str(exc)})
        raise
    finally:
        db_session.remove()
