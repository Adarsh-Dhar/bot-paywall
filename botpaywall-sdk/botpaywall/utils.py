"""
Utility functions for BotPaywall SDK.
"""

from datetime import datetime
from urllib.parse import urlparse
from typing import Optional, Dict, Any


LOG_ICONS = {
    "INFO": "ℹ️ ",
    "SUCCESS": "✅",
    "ERROR": "❌",
    "PAYMENT": "💳",
    "WAIT": "⏳",
    "SCRAPE": "🔍",
    "LOCK": "🔐",
    "SAVE": "💾",
    "DEBUG": "🔧",
}


def log(message: str, level: str = "INFO", silent: bool = False) -> None:
    """
    Print formatted log message with timestamp and icon.

    Args:
        message: The message to log
        level: Log level (INFO, SUCCESS, ERROR, PAYMENT, WAIT, SCRAPE, LOCK, SAVE, DEBUG)
        silent: If True, suppress output
    """
    if silent:
        return

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    icon = LOG_ICONS.get(level, "  ")
    print(f"[{timestamp}] {icon} {message}")


def extract_domain_from_url(url: str) -> Optional[str]:
    """
    Extract domain from URL.

    Examples:
        - https://example.com/path -> example.com
        - https://sub.example.com/ -> sub.example.com

    Args:
        url: The URL to extract domain from

    Returns:
        The domain/hostname or None if extraction fails
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        return hostname if hostname else None
    except Exception:
        return None


def extract_client_ip(payment_info: Optional[Dict[str, Any]]) -> Optional[str]:
    """
    Extract client IP from payment info response.

    Args:
        payment_info: Dictionary containing payment info response

    Returns:
        The client IP or None if not found
    """
    if not payment_info:
        return None

    ip = (
        payment_info.get('client_ip') or
        payment_info.get('user_context', {}).get('ip') or
        payment_info.get('ip')
    )

    return ip


def format_move_amount(octas: int) -> float:
    """Convert octas to MOVE tokens (1 MOVE = 100,000,000 octas)."""
    return octas / 100_000_000


def octas_from_move(move: float) -> int:
    """Convert MOVE tokens to octas."""
    return int(move * 100_000_000)
