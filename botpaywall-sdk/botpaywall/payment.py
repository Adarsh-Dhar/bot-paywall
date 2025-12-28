"""
Payment module for BotPaywall SDK.

Handles blockchain payments using Movement/Aptos SDK.
"""

import asyncio
import time
from typing import Optional, Dict, Any

import requests

from .config import BotPaywallConfig
from .utils import log


class PaymentClient:
    """
    Client for handling blockchain payments.

    Manages x402 payment flow with Movement blockchain.
    """

    def __init__(self, config: BotPaywallConfig):
        """
        Initialize the payment client.

        Args:
            config: BotPaywall configuration object
        """
        self.config = config
        self._account = None

    def _get_account(self):
        """Get or create the blockchain account from private key."""
        if self._account is None:
            if not self.config.private_key:
                raise ValueError("Private key is required for payments. Set it in config.")

            from aptos_sdk.account import Account
            self._account = Account.load_key(self.config.private_key)

        return self._account

    def get_payment_info(self) -> Optional[Dict[str, Any]]:
        """
        Get payment information from access server.

        Returns:
            Payment info dict or None if failed
        """
        try:
            log("Getting payment information from access server...", "INFO")

            response = requests.get(
                f"{self.config.access_server_url}/payment-info",
                timeout=self.config.request_timeout
            )

            if response.status_code == 200:
                info = response.json()
                log("Payment information retrieved", "SUCCESS")
                return info
            else:
                log(f"Failed to get payment info: {response.status_code}", "ERROR")
                return None

        except Exception as e:
            log(f"Error getting payment info: {e}", "ERROR")
            return None

    def make_blockchain_payment(self, payment_address: str, amount_octas: int) -> str:
        """
        Make actual MOVE token payment using Movement blockchain.

        Args:
            payment_address: Recipient address
            amount_octas: Amount in octas

        Returns:
            Transaction hash

        Raises:
            ValueError: If private key not configured
            Exception: If payment fails
        """
        from aptos_sdk.async_client import RestClient
        from aptos_sdk.account_address import AccountAddress

        async def _make_payment():
            account = self._get_account()
            client = RestClient(self.config.network_url)

            try:
                recipient = AccountAddress.from_str(payment_address)

                txn_hash = await client.transfer_coins(
                    sender=account,
                    recipient=recipient,
                    amount=amount_octas,
                    coin_type="0x1::aptos_coin::AptosCoin"
                )

                await client.wait_for_transaction(txn_hash)
                return txn_hash
            finally:
                await client.close()

        return asyncio.run(_make_payment())

    def process_402_payment(self, payment_data: Dict[str, Any]) -> Optional[str]:
        """
        Process a 402 Payment Required response.

        Extracts payment details and makes the blockchain payment.

        Args:
            payment_data: The 402 response JSON data

        Returns:
            Transaction hash if successful, None otherwise
        """
        try:
            accepts = payment_data.get('accepts', [])
            if not accepts:
                log("Invalid payment data: no accepts array found", "ERROR")
                return None

            payment_option = accepts[0]
            payment_address = payment_option.get('payTo')
            max_amount_octas = payment_option.get('maxAmountRequired')

            if not payment_address or not max_amount_octas:
                log("Invalid payment data: missing payTo or maxAmountRequired", "ERROR")
                return None

            amount_move = int(max_amount_octas) / 100_000_000
            log(f"Payment Address: {payment_address}", "INFO")
            log(f"Amount: {amount_move} MOVE ({max_amount_octas} octas)", "INFO")

            log("Making blockchain payment...", "PAYMENT")
            tx_hash = self.make_blockchain_payment(payment_address, int(max_amount_octas))
            log(f"Payment made: {tx_hash}", "SUCCESS")

            log("Waiting for transaction confirmation...", "WAIT")
            time.sleep(3)

            return tx_hash

        except Exception as e:
            log(f"Error processing payment: {e}", "ERROR")
            return None
