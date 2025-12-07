import requests
from web3 import Web3
from eth_account import Account
import time
import os

# CONFIGURATION
# Primary RPC endpoint (with fallback)
RPC_URLS = [
    "https://30732.rpc.thirdweb.com",  # Movement Testnet (thirdweb)
    "https://full.testnet.movementinfra.xyz/v1",  # Movement Testnet (official fallback)
]
TARGET_URL = "https://test-cloudflare-website.adarsh.software/"
MY_KEY =   "0xafcc93f1f5bf61dadb43da473273a900754b12714243e3aa6124dfee14341871"
SECRET_HANDSHAKE = "open-sesame-move-2025"  # Secret header to bypass Cloudflare WAF
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# Validate private key
if not MY_KEY:
    raise ValueError("❌ MOVEMENT_PRIVATE_KEY environment variable is not set. Please set it with: export MOVEMENT_PRIVATE_KEY=your_MOVEMENT_PRIVATE_KEY_here")

# Remove 0x prefix if present
if MY_KEY.startswith("0x"):
    MY_KEY = MY_KEY[2:]

# Validate hex format
try:
    int(MY_KEY, 16)
except ValueError:
    raise ValueError("❌ MOVEMENT_PRIVATE_KEY is not a valid hexadecimal string. It should be 64 hex characters (with or without 0x prefix).")

class PaywallBreaker:
    def __init__(self):
        self.w3 = None
        self.rpc_url = None
        self.account = Account.from_key(MY_KEY)
        self.address = self.account.address
        print(f"🤖 Bot Wallet: {self.address}")
        self._connect_to_rpc()
    
    def _connect_to_rpc(self):
        """Try to connect to RPC endpoints with fallback support."""
        for rpc_url in RPC_URLS:
            try:
                print(f"🔌 Attempting to connect to RPC: {rpc_url}")
                w3 = Web3(Web3.HTTPProvider(rpc_url))
                # Test connection by getting chain ID
                chain_id = w3.eth.chain_id
                if chain_id:
                    self.w3 = w3
                    self.rpc_url = rpc_url
                    print(f"✅ Connected to RPC: {rpc_url} (Chain ID: {chain_id})")
                    return
            except Exception as e:
                print(f"⚠️ Failed to connect to {rpc_url}: {str(e)}")
                continue
        
        raise ConnectionError(
            f"❌ Failed to connect to any RPC endpoint. Tried: {', '.join(RPC_URLS)}\n"
            "Please check your internet connection or try again later."
        )
    
    def _retry_rpc_call(self, func_name, *args, **kwargs):
        """Retry an RPC call with exponential backoff.
        
        Args:
            func_name: String name of the method to call (e.g., 'get_transaction_count')
                      or a callable function. If string, will be called on self.w3.eth.
        """
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                # If func_name is a string, get the method from self.w3.eth
                if isinstance(func_name, str):
                    func = getattr(self.w3.eth, func_name)
                else:
                    func = func_name
                return func(*args, **kwargs)
            except Exception as e:
                last_error = e
                error_msg = str(e)
                # Check if it's an RPC error that might be temporary
                if "not able to process" in error_msg.lower() or "-32603" in error_msg or "connection" in error_msg.lower():
                    if attempt < MAX_RETRIES - 1:
                        wait_time = RETRY_DELAY * (2 ** attempt)
                        print(f"⚠️ RPC error (attempt {attempt + 1}/{MAX_RETRIES}): {error_msg[:100]}")
                        print(f"   Retrying in {wait_time} seconds...")
                        time.sleep(wait_time)
                        # Try reconnecting to RPC
                        try:
                            self._connect_to_rpc()
                        except Exception as reconnect_error:
                            print(f"   ⚠️ Reconnection attempt failed: {str(reconnect_error)[:100]}")
                        continue
                # For other errors, raise immediately
                raise
        
        # If all retries failed, raise the last error
        raise last_error

    def pay_and_scrape(self):
        print(f"1. Attempting to access: {TARGET_URL}")
        
        # SECRET HANDSHAKE HEADERS
        # This gets us past the Cloudflare 403 WAF so we can reach the Worker
        init_headers = {
            "x-secret-handshake": SECRET_HANDSHAKE,
            "User-Agent": "Movement-Scraper/1.0"
        }
        
        # A. First Request (Pass the WAF, hit the Worker)
        # We expect a 402 from the Worker now, NOT a 403 from Cloudflare
        r = requests.get(TARGET_URL, headers=init_headers)
        
        if r.status_code == 200:
            print("⚠️ Site is open! No payment needed.")
            return r.text
            
        if r.status_code == 403:
            print("❌ Still getting 403? Check your WAF 'Skip' rule.")
            print("   Make sure the Cloudflare WAF rule is configured to skip security")
            print("   when the 'x-secret-handshake' header is present.")
            print(r.text)
            return
            
        if r.status_code != 402:
            print(f"❌ Unexpected error: {r.status_code}")
            print(r.text)
            return
            
        # B. Parse Payment Request
        print("🔒 Paywall detected (402). Analyzing costs...")
        demand = r.json()
        
        cost_move = demand['price_move']
        receiver = demand['payment_address']
        cost_wei = self.w3.to_wei(cost_move, 'ether')
        
        print(f"💰 Sending {cost_move} MOVE to {receiver}...")
        # C. Pay on Blockchain
        try:
            # Get nonce with retry logic
            nonce = self._retry_rpc_call('get_transaction_count', self.address)
            gas_price = self._retry_rpc_call('gas_price')
            
            tx = {
                'nonce': nonce,
                'to': receiver,
                'value': cost_wei,
                'gas': 100000,
                'gasPrice': gas_price,
                'chainId': 30732
            }
            
            signed = self.w3.eth.account.sign_transaction(tx, MY_KEY)
            tx_hash = self._retry_rpc_call('send_raw_transaction', signed.raw_transaction)
            tx_hex = self.w3.to_hex(tx_hash)
            
            print(f"⏳ Tx sent: {tx_hex}. Waiting for receipt...")
            self._retry_rpc_call('wait_for_transaction_receipt', tx_hash)
            print("✅ Payment confirmed on-chain.")
        except Exception as e:
            print(f"❌ Transaction failed: {str(e)}")
            print("   This could be due to:")
            print("   - Insufficient balance for gas + payment")
            print("   - RPC endpoint issues (will retry automatically)")
            print("   - Network connectivity problems")
            raise
        # D. Retry with Proof AND The Handshake
        print("🔓 Re-accessing site with payment proof...")
        final_headers = {
            "X-Payment-Hash": tx_hex,
            "x-secret-handshake": SECRET_HANDSHAKE,  # KEEP THIS!
            "User-Agent": "Movement-Scraper/1.0"
        }
        
        final_r = requests.get(TARGET_URL, headers=final_headers)
        
        if final_r.status_code == 200:
            print("🎉 SUCCESS! Content scraped:")
            print("-" * 20)
            print(final_r.text[:500])  # Print first 500 chars
            print("-" * 20)
        else:
            print(f"❌ Access denied: {final_r.status_code}")
            print(final_r.text)

if __name__ == "__main__":
    bot = PaywallBreaker()
    bot.pay_and_scrape()



