"""
Configuration module for BotPaywall SDK.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict
import os


DEFAULT_BOT_HEADERS = {
    'User-Agent': 'BotPaywall-SDK/1.0 python-requests',
    'Accept': 'application/json',
}


@dataclass
class BotPaywallConfig:
    """
    Configuration for BotPaywall SDK.

    Attributes:
        access_server_url: URL of the access server handling x402 payments
        main_app_url: URL of the main bot-paywall app
        private_key: Private key for blockchain payments (Movement/Aptos)
        network_url: Blockchain network RPC URL
        max_retries: Maximum number of retry attempts
        wait_after_payment: Seconds to wait after payment for propagation
        retry_delay: Seconds between retries
        request_timeout: HTTP request timeout in seconds
        bot_headers: Headers to use for bot identification
    """
    access_server_url: str = "http://localhost:5000"
    main_app_url: str = "http://localhost:3000"
    private_key: Optional[str] = None
    network_url: str = "https://testnet.movementnetwork.xyz/v1"
    max_retries: int = 3
    wait_after_payment: int = 10
    retry_delay: int = 5
    request_timeout: int = 30
    bot_headers: Dict[str, str] = field(default_factory=lambda: DEFAULT_BOT_HEADERS.copy())

    def update(self, **kwargs):
        """Update configuration with provided keyword arguments."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self

    def to_dict(self) -> dict:
        """Convert config to dictionary."""
        return {
            'access_server_url': self.access_server_url,
            'main_app_url': self.main_app_url,
            'private_key': '***' if self.private_key else None,
            'network_url': self.network_url,
            'max_retries': self.max_retries,
            'wait_after_payment': self.wait_after_payment,
            'retry_delay': self.retry_delay,
            'request_timeout': self.request_timeout,
        }
