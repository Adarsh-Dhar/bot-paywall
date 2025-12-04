import json
from typing import Any, Dict, Optional

import requests
from eth_account import Account
from web3 import Web3


class MovementX402Scraper:
    """
    x402-enabled scraper for Movement's MEVM.

    - Sends an initial HTTP GET to the target URL.
    - If the response is 200, returns the content.
    - If the response is 402, parses payment requirements, sends an on-chain
      payment transaction, then retries the request with a payment proof header.
    """

    def __init__(self, rpc_url: str, private_key: str) -> None:
        """
        Initialize the scraper.

        NOTE:
        We defer the actual RPC connection until we *need* to pay for access.
        This lets you run the scraper against free / non-paywalled endpoints
        (e.g. local development at http://localhost:3000) even if the Movement
        RPC is temporarily unreachable.
        """
        self.rpc_url = rpc_url
        self.private_key = private_key

        # Lazy‑init Web3 on first payment attempt.
        self.w3: Optional[Web3] = None
        self.account = Account.from_key(private_key)
        self.address = self.account.address

        print(f"Bot initialized. Wallet: {self.address}")

    def _ensure_web3(self) -> Web3:
        """
        Lazily create and validate the Web3 connection.

        Raises a clear error if the Movement RPC is not reachable.
        """
        if self.w3 is None:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))

            if not self.w3.is_connected():
                raise ConnectionError(
                    "Failed to connect to Movement Network RPC at "
                    f"{self.rpc_url}. "
                    "Double‑check that:\n"
                    "- The URL is correct (testnet: https://full.testnet.movementinfra.xyz/v1 "
                    "or mainnet: https://full.mainnet.movementinfra.xyz/v1)\n"
                    "- Your network/firewall allows outbound HTTPS to that host\n"
                    "- The RPC endpoint is currently healthy."
                )

        return self.w3

    def get_headers(self, payment_proof: Optional[str] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "User-Agent": "Movement-x402-Scraper/1.0",
            "Accept": "application/json, text/html",
        }

        if payment_proof:
            # Standard x402 approach: the proof is often included in either an
            # Authorization header or a custom payment header.
            headers["X-Payment-Hash"] = payment_proof
            headers["Authorization"] = f"Bearer {payment_proof}"

        return headers

    def pay_for_access(self, payment_details: Dict[str, Any]) -> str:
        """
        Execute a payment on the Movement MEVM chain according to the
        payment_details structure.

        Expected keys:
          - receiver: destination address (string)
          - amount_wei: amount to send in wei (int or numeric string)
        """
        receiver = payment_details.get("receiver")
        amount_wei_raw = payment_details.get("amount_wei", 0)

        if receiver is None:
            raise ValueError("Payment details missing 'receiver' address")

        try:
            amount_wei = int(amount_wei_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid 'amount_wei' value: {amount_wei_raw}") from exc

        print(f"402 Paywall detected. Sending {amount_wei} wei to {receiver} on Movement...")

        # Ensure we have a healthy RPC connection before building a tx
        w3 = self._ensure_web3()

        # Construct transaction
        nonce = w3.eth.get_transaction_count(self.address)
        gas_price = w3.eth.gas_price

        tx = {
            "nonce": nonce,
            "to": receiver,
            "value": amount_wei,
            "gas": 200_000,
            "gasPrice": gas_price,
            "chainId": w3.eth.chain_id,
        }

        # Sign and broadcast transaction
        signed_tx = w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = w3.to_hex(tx_hash)

        print(f"Payment sent! Hash: {tx_hash_hex}")

        # Wait for confirmation (Movement is fast; wait for 1 block confirmation)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        status = getattr(receipt, "status", None)
        if status != 1:
            raise RuntimeError(f"Transaction {tx_hash_hex} failed with status {status}")

        return tx_hash_hex

    def _parse_402_payment_request(self, response: requests.Response) -> Dict[str, Any]:
        """
        Attempt to parse payment instructions from a 402 response.

        By default, we assume a JSON body with at least:
          { "receiver": "0x...", "price": 100 }

        You can customize this to handle WWW-Authenticate headers or
        other formats as needed.
        """
        # Try JSON body first
        try:
            data = response.json()
        except json.JSONDecodeError:
            raise ValueError("402 response did not contain valid JSON for payment details")

        receiver = data.get("receiver")
        price = data.get("price")

        if receiver is None or price is None:
            raise ValueError(
                "402 payment JSON is missing required fields 'receiver' and/or 'price'"
            )

        return {"receiver": receiver, "amount_wei": price}

    def scrape(self, url: str) -> Optional[str]:
        """
        Perform a GET request against the target URL and handle 402 paywalls
        by paying on-chain and retrying with payment proof.
        """
        print(f"Attempting to scrape: {url}")

        # 1. First attempt (no payment)
        response = requests.get(url, headers=self.get_headers(), timeout=30)

        if response.status_code == 200:
            print("Success (free content).")
            return response.text

        if response.status_code == 402:
            try:
                payment_req = self._parse_402_payment_request(response)

                # Execute payment logic
                proof = self.pay_for_access(payment_req)

                # 3. Retry with proof
                print("Retrying with payment proof...")
                paid_response = requests.get(
                    url,
                    headers=self.get_headers(payment_proof=proof),
                    timeout=30,
                )

                if paid_response.status_code == 200:
                    print("Access granted after payment.")
                    return paid_response.text

                print(
                    "Payment sent but access denied: "
                    f"status={paid_response.status_code}, body={paid_response.text[:200]}"
                )
                return None

            except Exception as exc:
                print(f"Error during payment flow: {exc}")
                return None

        print(f"Request failed with status: {response.status_code}")
        return None


