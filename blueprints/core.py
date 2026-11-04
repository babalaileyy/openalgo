from flask import Blueprint, jsonify

core_bp = Blueprint("core_bp", __name__)


@core_bp.route("/setup", methods=["POST"])
def setup():
    """Account registration is disabled for this installation."""
    return jsonify({"status": "error", "message": "Registration is disabled."}), 403
