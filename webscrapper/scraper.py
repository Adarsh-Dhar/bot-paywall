#!/usr/bin/env python3
"""
Advanced webscraper with HTTP 402 payment support for Cloudflare-protected sites.
Integrates with Aptos blockchain for payment verification.
"""

import requests
from datetime import datetime
import sys
import json
import time
import os

# Configuration
SCRAPER_CONFIG = {
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    'access_server_url': 'http://localhost:3000/buy-access',
    'aptos_wallet_private_key': "0xafcc93f1f5bf61dadb43da473273a900754b12714243e3aa6124dfee14341871",
    'payment_destination': '0xYOUR_WALLET_ADDRESS_HERE',
    'max_retries': 3,
    'retry_delay': 5,
    'payment_amount_octas': 1000000  # 0.01 MOVE = 1,000,000 octas
}

class PaymentRequiredException(Exception):
    """Raised when 402 Payment Required is returned"""
    def __init__(self, payment_info):
        self.payment_info = payment_info
        super().__init__("Payment required to access content")

def make_aptos_payment(payment_address, amount_octas):
    """
    Make a payment on Aptos blockchain.
    
    Args:
        payment_address (str): Destination wallet address
        amount_octas (int): Amount in octas (1 MOVE = 100,000,000 octas)
    
    Returns:
        str: Transaction hash if successful, None otherwise
    """
    try:
        from aptos_sdk.account import Account
        from aptos_sdk.client import RestClient
        from aptos_sdk.transactions import EntryFunction, TransactionArgument, TypeTag, StructTag
        
        # Initialize Aptos client for mainnet
        rest_client = RestClient("https://fullnode.mainnet.aptoslabs.com/v1")
        
        # Load account from private key
        # SECURITY WARNING: Never hardcode private keys in production!
        # Use environment variables: os.getenv('APTOS_PRIVATE_KEY')
        private_key = SCRAPER_CONFIG['aptos_wallet_private_key']
        
        if private_key == 'YOUR_PRIVATE_KEY_HERE':
            print(f"[{datetime.now()}] ❌ ERROR: Please configure APTOS_PRIVATE_KEY")
            print("Set it via environment variable: export APTOS_PRIVATE_KEY='your_key'")
            return None
        
        account = Account.load_key(private_key)
        
        print(f"[{datetime.now()}] 💰 Initiating payment:")
        print(f"   From: {account.address()}")
        print(f"   To: {payment_address}")
        print(f"   Amount: {amount_octas} octas ({amount_octas/100000000} MOVE)")
        
        # Create APT coin transfer transaction
        payload = EntryFunction.natural(
            "0x1::coin",
            "transfer",
            [TypeTag(StructTag.from_str("0x1::aptos_coin::AptosCoin"))],
            [
                TransactionArgument(payment_address, Serializer.struct),
                TransactionArgument(amount_octas, Serializer.u64),
            ],
        )
        
        # Submit transaction
        print(f"[{datetime.now()}] 📤 Submitting transaction...")
        signed_transaction = rest_client.create_bcs_signed_transaction(account, payload)
        txn_hash = rest_client.submit_bcs_transaction(signed_transaction)
        
        print(f"[{datetime.now()}] 🔗 Transaction hash: {txn_hash}")
        
        # Wait for transaction confirmation
        print(f"[{datetime.now()}] ⏳ Waiting for transaction confirmation...")
        rest_client.wait_for_transaction(txn_hash)
        
        print(f"[{datetime.now()}] ✅ Payment confirmed on blockchain!")
        return txn_hash
        
    except ImportError as e:
        print(f"[{datetime.now()}] ❌ Aptos SDK not installed: {e}")
        print("Install it with: pip install aptos-sdk")
        return None
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Payment failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def request_access(tx_hash, scraper_ip=None):
    """
    Submit payment proof to access server to get IP whitelisted.
    
    Args:
        tx_hash (str): Aptos transaction hash
        scraper_ip (str, optional): IP address to whitelist (auto-detected if None)
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        print(f"[{datetime.now()}] 🔑 Requesting access with transaction: {tx_hash}")
        
        payload = {'tx_hash': tx_hash}
        
        if scraper_ip:
            payload['scraper_ip'] = scraper_ip
            print(f"[{datetime.now()}] 📍 Requesting whitelist for IP: {scraper_ip}")
        
        response = requests.post(
            SCRAPER_CONFIG['access_server_url'],
            json=payload,
            timeout=30
        )
        
        print(f"[{datetime.now()}] Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            expires_in = data.get('expires_in', 'unknown')
            print(f"[{datetime.now()}] ✅ Access granted! Expires in: {expires_in}")
            return True, f"Access granted for {expires_in}"
        elif response.status_code == 402:
            error_data = response.json()
            error_msg = error_data.get('error', 'Payment verification failed')
            print(f"[{datetime.now()}] ❌ Payment verification failed: {error_msg}")
            return False, error_msg
        else:
            error_text = response.text
            print(f"[{datetime.now()}] ❌ Access request failed: {error_text}")
            return False, f"Access denied: {error_text}"
            
    except requests.exceptions.ConnectionError as e:
        error_msg = f"Cannot connect to access server at {SCRAPER_CONFIG['access_server_url']}"
        print(f"[{datetime.now()}] ❌ {error_msg}")
        print("Is the access server running?")
        return False, error_msg
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error requesting access: {e}")
        import traceback
        traceback.print_exc()
        return False, str(e)

def scrape_website(url, max_retries=3):
    """
    Scrape the given URL with HTTP 402 payment support.
    
    Args:
        url (str): The URL to scrape
        max_retries (int): Maximum number of retry attempts
    
    Returns:
        str: The page content or None if failed
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    }
    
    for attempt in range(max_retries):
        try:
            print(f"\n[{datetime.now()}] 🔍 Scraping attempt {attempt + 1}/{max_retries}")
            print(f"[{datetime.now()}] Target: {url}")
            
            response = requests.get(url, headers=headers, timeout=30)
            
            print(f"[{datetime.now()}] Response status code: {response.status_code}")
            print(f"[{datetime.now()}] Response headers:")
            for key in ['Content-Type', 'X-Bot-Protection', 'WWW-Authenticate', 'Server']:
                if key in response.headers:
                    print(f"  {key}: {response.headers[key]}")
            
            # Handle different response codes
            if response.status_code == 402:
                print(f"\n[{datetime.now()}] 💳 HTTP 402 PAYMENT REQUIRED")
                
                try:
                    payment_info = response.json()
                    print(f"\n📋 Payment Details:")
                    print(f"  💰 Amount: {payment_info.get('payment_amount')} {payment_info.get('payment_currency')}")
                    print(f"  📫 Address: {payment_info.get('payment_address')}")
                    print(f"  🌐 Your IP: {payment_info.get('client_ip')}")
                    print(f"  📝 Message: {payment_info.get('message')}")
                    print(f"  ⏰ Timestamp: {payment_info.get('timestamp')}")
                    
                    # Make payment
                    print(f"\n[{datetime.now()}] Initiating payment process...")
                    tx_hash = make_aptos_payment(
                        payment_info.get('payment_address'),
                        SCRAPER_CONFIG['payment_amount_octas']
                    )
                    
                    if not tx_hash:
                        print(f"[{datetime.now()}] ❌ Payment failed, cannot continue")
                        return None
                    
                    # Request access with transaction hash
                    print(f"\n[{datetime.now()}] Submitting payment proof to access server...")
                    success, message = request_access(tx_hash, payment_info.get('client_ip'))
                    
                    if not success:
                        print(f"[{datetime.now()}] ❌ Access request failed: {message}")
                        if attempt < max_retries - 1:
                            print(f"[{datetime.now()}] Retrying in {SCRAPER_CONFIG['retry_delay']} seconds...")
                            time.sleep(SCRAPER_CONFIG['retry_delay'])
                            continue
                        return None
                    
                    # Wait for whitelisting to propagate
                    wait_time = 3
                    print(f"[{datetime.now()}] ⏳ Waiting {wait_time}s for whitelisting to propagate...")
                    time.sleep(wait_time)
                    
                    # Retry the request
                    print(f"[{datetime.now()}] 🔄 Retrying scrape after payment verification...")
                    continue  # Go back to the start of the loop
                    
                except json.JSONDecodeError:
                    print(f"[{datetime.now()}] ❌ Invalid JSON in 402 response")
                    print(f"Response body: {response.text[:200]}")
                    return None
                except Exception as e:
                    print(f"[{datetime.now()}] ❌ Error processing payment: {e}")
                    import traceback
                    traceback.print_exc()
                    return None
            
            elif response.status_code == 403:
                print(f"\n[{datetime.now()}] 🚫 HTTP 403 FORBIDDEN")
                print("Your IP may have been blocked or payment verification failed")
                if "Payment Verification Failed" in response.text:
                    print("The payment could not be verified. Please check:")
                    print("  - Transaction hash is correct")
                    print("  - Payment amount matches requirement")
                    print("  - Payment was sent to correct address")
                return None
            
            elif response.status_code == 200:
                # Check for Cloudflare challenge (shouldn't happen after whitelisting)
                if "Just a moment..." in response.text or "cf-mitigated: challenge" in str(response.headers):
                    print(f"\n[{datetime.now()}] ⚠️ Cloudflare challenge detected")
                    print("This shouldn't happen after whitelisting. Possible issues:")
                    print("  - Whitelisting hasn't propagated yet")
                    print("  - Additional bot protection is active")
                    if attempt < max_retries - 1:
                        print(f"[{datetime.now()}] Waiting and retrying...")
                        time.sleep(5)
                        continue
                    return None
                
                # Success!
                print(f"\n[{datetime.now()}] ✅ SCRAPING SUCCESSFUL!")
                print(f"Content length: {len(response.text)} characters")
                print(f"Content type: {response.headers.get('Content-Type', 'unknown')}")
                
                # Log first 500 characters
                print("\n" + "=" * 80)
                print("CONTENT PREVIEW (first 500 chars):")
                print("=" * 80)
                print(response.text[:500])
                if len(response.text) > 500:
                    print(f"\n... ({len(response.text) - 500} more characters)")
                print("=" * 80)
                
                return response.text
            
            else:
                print(f"[{datetime.now()}] ❌ Unexpected status code: {response.status_code}")
                print(f"Response: {response.text[:200]}")
                if attempt < max_retries - 1:
                    print(f"[{datetime.now()}] Retrying in {SCRAPER_CONFIG['retry_delay']} seconds...")
                    time.sleep(SCRAPER_CONFIG['retry_delay'])
                    continue
                return None
                
        except requests.exceptions.Timeout:
            print(f"[{datetime.now()}] ⏱️ Request timeout")
            if attempt < max_retries - 1:
                print(f"[{datetime.now()}] Retrying in {SCRAPER_CONFIG['retry_delay']} seconds...")
                time.sleep(SCRAPER_CONFIG['retry_delay'])
                continue
            return None
            
        except requests.exceptions.ConnectionError as e:
            print(f"[{datetime.now()}] 🔌 Connection error: {e}")
            if attempt < max_retries - 1:
                print(f"[{datetime.now()}] Retrying in {SCRAPER_CONFIG['retry_delay']} seconds...")
                time.sleep(SCRAPER_CONFIG['retry_delay'])
                continue
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"[{datetime.now()}] ❌ Request error: {e}")
            if attempt < max_retries - 1:
                print(f"[{datetime.now()}] Retrying in {SCRAPER_CONFIG['retry_delay']} seconds...")
                time.sleep(SCRAPER_CONFIG['retry_delay'])
                continue
            return None
    
    print(f"[{datetime.now()}] ❌ All retry attempts exhausted")
    return None

def main():
    """Main function to run the scraper."""
    url = SCRAPER_CONFIG['target_url']
    
    print("=" * 80)
    print("HTTP 402 Payment-Enabled Web Scraper")
    print("=" * 80)
    print(f"Target URL: {url}")
    print(f"Access Server: {SCRAPER_CONFIG['access_server_url']}")
    print(f"Payment Amount: {SCRAPER_CONFIG['payment_amount_octas']} octas ({SCRAPER_CONFIG['payment_amount_octas']/100000000} MOVE)")
    print(f"Max Retries: {SCRAPER_CONFIG['max_retries']}")
    print("-" * 80)
    
    # Configuration check
    if SCRAPER_CONFIG['aptos_wallet_private_key'] == 'YOUR_PRIVATE_KEY_HERE':
        print("\n⚠️  WARNING: Aptos private key not configured!")
        print("Set it via environment variable:")
        print("  export APTOS_PRIVATE_KEY='your_private_key_here'")
        print("\nPayment functionality will not work without a valid private key.")
        print("-" * 80)
    
    # Scrape the website
    start_time = datetime.now()
    content = scrape_website(url, SCRAPER_CONFIG['max_retries'])
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    if content:
        print(f"\n[{datetime.now()}] ✅ Scraping completed successfully!")
        print(f"Duration: {duration:.2f} seconds")
        
        # Save to file
        output_file = 'scraped_content.html'
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"[{datetime.now()}] 💾 Content saved to {output_file}")
        except Exception as e:
            print(f"[{datetime.now()}] ⚠️  Could not save to file: {e}")
        
        return 0
    else:
        print(f"\n[{datetime.now()}] ❌ Scraping failed after {duration:.2f} seconds!")
        print("\nPossible reasons:")
        print("  - Payment verification failed")
        print("  - Network connectivity issues")
        print("  - Access server not reachable")
        print("  - Insufficient funds for payment")
        print("  - Invalid configuration")
        return 1

if __name__ == "__main__":
    sys.exit(main())