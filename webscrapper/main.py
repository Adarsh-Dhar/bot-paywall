import requests
from web3 import Web3
from eth_account import Account
import time
import os

# CONFIGURATION
# Primary RPC endpoint (with fallback)
RPC_URLS = [
    "https://30732.rpc.thirdweb.com/196125bedfc9a540d597b407838c22d3",  # Movement Testnet (thirdweb)
    "https://full.testnet.movementinfra.xyz/v1",  # Movement Testnet (official)
    "https://aptos.testnet.bardock.movementlabs.xyz/v1",  # Movement Testnet (alternative)
]
TARGET_URL = "https://test-cloudflare-website.adarsh.software/"
MY_KEY =   "0xafcc93f1f5bf61dadb43da473273a900754b12714243e3aa6124dfee14341871"
SECRET_HANDSHAKE = "open-sesame-move-2025"  # Secret header to bypass Cloudflare WAF
MAX_RETRIES = 1
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
    
    def _connect_to_rpc(self, skip_url=None):
        """Try to connect to RPC endpoints with fallback support.
        
        Args:
            skip_url: Optional RPC URL to skip (useful when switching from a failing endpoint)
        """
        for rpc_url in RPC_URLS:
            if skip_url and rpc_url == skip_url:
                continue
            try:
                print(f"🔌 Attempting to connect to RPC: {rpc_url}")
                # Create provider with request timeout
                provider = Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10})
                w3 = Web3(provider)
                
                # Test connection by getting chain ID (this makes an actual RPC call)
                try:
                    chain_id = w3.eth.chain_id
                    if chain_id:
                        self.w3 = w3
                        self.rpc_url = rpc_url
                        print(f"✅ Connected to RPC: {rpc_url} (Chain ID: {chain_id})")
                        return
                except Exception as chain_error:
                    # If chain_id fails, try a simpler test - get block number
                    try:
                        block_num = w3.eth.block_number
                        chain_id = 30732  # Movement testnet chain ID
                        self.w3 = w3
                        self.rpc_url = rpc_url
                        print(f"✅ Connected to RPC: {rpc_url} (Chain ID: {chain_id}, Block: {block_num})")
                        return
                    except Exception as block_error:
                        raise chain_error  # Raise the original error
            except Exception as e:
                error_msg = str(e)
                # Truncate long error messages
                if len(error_msg) > 150:
                    error_msg = error_msg[:147] + "..."
                print(f"⚠️ Failed to connect to {rpc_url}: {error_msg}")
                continue
        
        raise ConnectionError(
            f"❌ Failed to connect to any RPC endpoint. Tried {len(RPC_URLS)} endpoints:\n" +
            "\n".join(f"   - {url}" for url in RPC_URLS) +
            "\n\nPlease check your internet connection or try again later."
        )
    
    def _is_rpc_error(self, error):
        """Check if an error is an RPC endpoint error."""
        error_str = str(error)
        return ("-32603" in error_str or 
                "not able to process" in error_str.lower() or 
                "'code': -32603" in error_str or
                "RPC" in error_str)
    
    def _try_with_fallback_rpc(self, func, *args, **kwargs):
        """Try to execute a function, and if it fails with RPC error, switch to fallback RPC and retry once."""
        try:
            return func(*args, **kwargs)
        except (ValueError, Exception) as e:
            if self._is_rpc_error(e):
                # Current RPC is failing, try to switch to a fallback
                old_rpc = self.rpc_url
                print(f"⚠️ RPC error detected with {old_rpc}, trying fallback endpoint...")
                try:
                    self._connect_to_rpc(skip_url=old_rpc)
                    print(f"✅ Switched to {self.rpc_url}, retrying operation...")
                    # Retry the operation with new RPC
                    return func(*args, **kwargs)
                except Exception as fallback_error:
                    print(f"❌ Fallback RPC also failed: {str(fallback_error)[:100]}")
                    raise e  # Raise original error
            else:
                # Not an RPC error, re-raise
                raise
    
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
        
        # Check balance before attempting transaction
        gas_limit = 100000  # Define gas limit upfront
        print(f"💰 Payment required: {cost_move} MOVE")
        try:
            # Try to get balance with fallback RPC support
            balance_wei = self._try_with_fallback_rpc(self.w3.eth.get_balance, self.address)
            balance_move = self.w3.from_wei(balance_wei, 'ether')
            print(f"💵 Wallet balance: {balance_move} MOVE")
            
            # Estimate gas cost
            gas_price = self._try_with_fallback_rpc(self.w3.eth.gas_price)
            gas_cost_wei = gas_limit * gas_price
            gas_cost_move = self.w3.from_wei(gas_cost_wei, 'ether')
            total_needed_wei = cost_wei + gas_cost_wei
            total_needed_move = self.w3.from_wei(total_needed_wei, 'ether')
            
            print(f"⛽ Estimated gas cost: {gas_cost_move} MOVE")
            print(f"📊 Total needed: {total_needed_move} MOVE (payment: {cost_move} MOVE + gas: {gas_cost_move} MOVE)")
            
            if balance_wei < total_needed_wei:
                shortage_wei = total_needed_wei - balance_wei
                shortage_move = self.w3.from_wei(shortage_wei, 'ether')
                print(f"❌ Insufficient balance!")
                print(f"   Need: {total_needed_move} MOVE")
                print(f"   Have: {balance_move} MOVE")
                print(f"   Short: {shortage_move} MOVE")
                raise ValueError(f"Insufficient balance. Need {total_needed_move} MOVE, have {balance_move} MOVE")
        except ValueError as e:
            error_str = str(e)
            if "Insufficient balance" in error_str:
                # Re-raise insufficient balance errors
                raise
            # Other ValueError (likely RPC error that fallback couldn't fix)
            print(f"⚠️ Could not check balance: {error_str[:100]}")
            print("   Proceeding with transaction attempt anyway...")
            # Try to get gas price at least
            try:
                gas_price = self._try_with_fallback_rpc(self.w3.eth.gas_price)
                gas_cost_wei = gas_limit * gas_price
                gas_cost_move = self.w3.from_wei(gas_cost_wei, 'ether')
                print(f"⛽ Estimated gas cost: {gas_cost_move} MOVE")
            except Exception:
                print("   Could not estimate gas cost either. Proceeding...")
        except Exception as e:
            error_str = str(e)
            print(f"⚠️ Could not check balance: {error_str[:100]}")
            print("   Proceeding with transaction attempt...")
        
        print(f"💸 Sending {cost_move} MOVE to {receiver}...")
        # C. Pay on Blockchain (no retries - try once only, but can switch RPC if needed)
        try:
            # Get nonce (will switch RPC if current one fails)
            nonce = self._try_with_fallback_rpc(self.w3.eth.get_transaction_count, self.address)
            gas_price = self._try_with_fallback_rpc(self.w3.eth.gas_price)
            
            tx = {
                'nonce': nonce,
                'to': receiver,
                'value': cost_wei,
                'gas': gas_limit,
                'gasPrice': gas_price,
                'chainId': 30732
            }
            
            signed = self.w3.eth.account.sign_transaction(tx, MY_KEY)
            tx_hash = self._try_with_fallback_rpc(self.w3.eth.send_raw_transaction, signed.raw_transaction)
            tx_hex = self.w3.to_hex(tx_hash)
            
            print(f"⏳ Tx sent: {tx_hex}. Waiting for receipt...")
            self._try_with_fallback_rpc(self.w3.eth.wait_for_transaction_receipt, tx_hash)
            print("✅ Payment confirmed on-chain.")
        except Exception as e:
            print(f"❌ Transaction failed: {str(e)}")
            print("   This could be due to:")
            print("   - Insufficient balance for gas + payment")
            print("   - RPC endpoint issues (all endpoints tried)")
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



