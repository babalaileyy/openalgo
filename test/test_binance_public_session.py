from unittest.mock import patch

from flask import Flask, session

from blueprints.auth import _try_resume_broker_session


def test_public_session_uses_existing_auth_completion(monkeypatch):
    monkeypatch.setenv("OPENALGO_MARKET_DATA_BROKER", "binance")
    app = Flask(__name__)
    app.secret_key = "test-only"
    with app.test_request_context("/auth/login", method="POST"):
        session["user"] = "alice"

        def finish(token, user, broker):
            assert (token, user, broker) == ("public-market-data", "alice", "binance")
            session["logged_in"] = True
            session["broker"] = broker
            return "ok", 200

        with patch("utils.plugin_loader.get_broker_capabilities",
                   return_value={"market_data_only": True}), \
             patch("utils.auth_utils.handle_auth_success", side_effect=finish):
            response, status = _try_resume_broker_session("alice")
        assert status == 200
        assert response.get_json()["redirect"] == "/trading"
        assert session["broker"] == "binance"


def test_failed_public_session_does_not_leave_logged_in_state(monkeypatch):
    monkeypatch.setenv("OPENALGO_MARKET_DATA_BROKER", "binance")
    app = Flask(__name__)
    app.secret_key = "test-only"
    with app.test_request_context("/auth/login", method="POST"):
        session["user"] = "alice"

        def fail(*_args):
            session["logged_in"] = True
            session["broker"] = "binance"
            return "failed", 500

        with patch("utils.plugin_loader.get_broker_capabilities",
                   return_value={"market_data_only": True}), \
             patch("utils.auth_utils.handle_auth_success", side_effect=fail):
            assert _try_resume_broker_session("alice") is None
        assert "logged_in" not in session
        assert "broker" not in session
