"""
BotPaywall SDK
==============

Python SDK for integrating with bot-paywall x402 payment protocol.

Usage:
    from botpaywall import BotPaywallClient
    
    client = BotPaywallClient(
        access_server_url="http://localhost:5000",
        main_app_url="http://localhost:3000",
        private_key="your_private_key"
    )
    
    # Get project credentials
    project = client.get_project_credentials("example.com")
    
    # Buy access
    result = client.buy_access(
        domain="example.com",
        zone_id=project['zone_id'],
        secret_key=project['secret_key']
    )
"""

from .client import BotPaywallClient
from .config import BotPaywallConfig
from .payment import PaymentClient
from .utils import extract_domain_from_url, extract_client_ip, log

__version__ = "0.1.0"

__all__ = [
    "BotPaywallClient",
    "BotPaywallConfig", 
    "PaymentClient",
    "extract_domain_from_url",
    "extract_client_ip",
    "log",
    "__version__",
]
