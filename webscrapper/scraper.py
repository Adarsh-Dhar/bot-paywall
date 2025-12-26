#!/usr/bin/env python3
"""
Simple Bot Scraper - x402 Payment Flow
This scraper communicates with the access-server to handle payments and whitelisting.
"""

import requests
import json
import time
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    # Target website (behind Cloudflare Worker paywall)
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    
    # Access server (handles x402 payments and whitelisting)
    'access_server_url': 'http://localhost:5000',
    
    # Retry settings
    'max_retries': 3,
    'wait_after_payment': 10,  # seconds to wait for whitelisting to propagate
    'retry_delay': 5  # seconds between retries
}

# =============================================================================
# BOT HEADERS - Intentionally identifies as a bot
# =============================================================================

BOT_HEADERS = {
    'User-Agent': 'SimpleBot/1.0 python-requests',  # Clear bot identifier
    'Accept': '*/*',  # Bot-like accept header
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def log(message, level="INFO"):
    """Print formatted log message"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    icons = {
        "INFO": "ℹ️ ",
        "SUCCESS": "✅",
        "ERROR": "❌",
        "PAYMENT": "💳",
        "WAIT": "⏳",
        "SCRAPE": "🔍",
        "LOCK": "🔐",
        "SAVE": "💾"
    }
    icon = icons.get(level, "  ")
    print(f"[{timestamp}] {icon} {message}")

def get_payment_info():
    """
    Get payment information from access server.
    """
    try:
        log("Getting payment information from access server...", "INFO")
        
        response = requests.get(
            f"{CONFIG['access_server_url']}/payment-info",
            timeout=10
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

def check_access_status(ip, domain):
    """
    Check if IP is whitelisted.
    Args:
        ip: The IP address to check
        domain: The domain name (e.g., 'test-cloudflare-website.adarsh.software')
    """
    try:
        response = requests.get(
            f"{CONFIG['access_server_url']}/check-access/{ip}",
            params={'domain': domain},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('whitelisted', False)
        
        return False
            
    except Exception as e:
        log(f"Error checking access status: {e}", "ERROR")
        return False


def make_blockchain_payment(payment_address, amount):
    """
    Make actual MOVE token payment using Movement blockchain.
    """
    import asyncio
    from aptos_sdk.account import Account
    from aptos_sdk.async_client import RestClient
    from aptos_sdk.account_address import AccountAddress
    
    async def _make_payment():
        # Load your wallet from private key
        account = Account.load_key("0xafcc93f1f5bf61dadb43da473273a900754b12714243e3aa6124dfee14341871")
        
        # Create REST client for Movement testnet
        client = RestClient("https://testnet.movementnetwork.xyz/v1")
        
        try:
            # Convert payment address to AccountAddress
            recipient = AccountAddress.from_str(payment_address)
            
            # Transfer coins (amount is in octas)
            # coin_type: "0x1::aptos_coin::AptosCoin" for Movement/MOVE tokens
            # transfer_coins returns the transaction hash
            txn_hash = await client.transfer_coins(
                sender=account,
                recipient=recipient,
                amount=amount,
                coin_type="0x1::aptos_coin::AptosCoin"
            )
            
            # Wait for transaction to complete
            await client.wait_for_transaction(txn_hash)
            
            return txn_hash
        finally:
            await client.close()
    
    # Run the async function
    return asyncio.run(_make_payment())        

def buy_access(scraper_ip, domain):
    """
    Purchase access for scraper IP.
    Args:
        scraper_ip: The IP address of the scraper
        domain: The domain name (e.g., 'test-cloudflare-website.adarsh.software')
    """
    try:
        # First attempt - will get 402 with payment instructions
        response = requests.post(
            f"{CONFIG['access_server_url']}/buy-access",
            json={
                'scraper_ip': scraper_ip,
                'domain': domain
            },
            timeout=120
        )
        
        if response.status_code == 402:
            # Extract payment details from x402 response
            payment_header = response.headers.get('X-PAYMENT-RESPONSE')
            payment_data = response.json()
            
            log("Making blockchain payment...", "PAYMENT")
            
            # Extract payment info from x402 response structure
            # x402 response format: { 'x402Version': 1, 'accepts': [{ 'payTo': '...', 'maxAmountRequired': '...', ... }] }
            accepts = payment_data.get('accepts', [])
            if not accepts or len(accepts) == 0:
                log(f"Invalid payment data: no accepts array found", "ERROR")
                log(f"Full response: {payment_data}", "ERROR")
                return False
            
            # Get the first payment option
            payment_option = accepts[0]
            
            # Extract payment address (payTo field in x402 format)
            payment_address = payment_option.get('payTo')
            
            # Extract amount (maxAmountRequired is in octas, convert to MOVE)
            # 1000000 octas = 0.01 MOVE (8 decimal places)
            max_amount_octas = payment_option.get('maxAmountRequired')
            if max_amount_octas:
                # Convert from octas to MOVE (divide by 100000000)
                amount_move = int(max_amount_octas) / 100000000
            else:
                amount_move = None
            
            if not payment_address or not amount_move:
                log(f"Invalid payment data: missing payTo or maxAmountRequired", "ERROR")
                log(f"Payment option: {payment_option}", "ERROR")
                log(f"Full response: {payment_data}", "ERROR")
                return False
            
            log(f"Payment Address: {payment_address}", "INFO")
            log(f"Amount: {amount_move} MOVE ({max_amount_octas} octas)", "INFO")
            
            # MAKE ACTUAL PAYMENT
            # Pass amount in octas (the raw blockchain amount) as integer
            amount_octas_int = int(max_amount_octas)
            tx_hash = make_blockchain_payment(payment_address, amount_octas_int)
            
            log(f"Payment made: {tx_hash}", "SUCCESS")
            
            # Wait a moment for transaction to be confirmed on blockchain
            log("Waiting for transaction confirmation...", "WAIT")
            time.sleep(3)  # Wait 3 seconds for blockchain confirmation
            
            # Retry request WITH PAYMENT PROOF
            # x402 middleware expects payment proof in header
            log(f"Retrying request with payment proof: {tx_hash}", "INFO")
            response = requests.post(
                f"{CONFIG['access_server_url']}/buy-access",
                json={
                    'scraper_ip': scraper_ip,
                    'domain': domain,
                    'tx_hash': tx_hash  # Include payment proof in body too
                },
                headers={
                    'X-PAYMENT-PROOF': tx_hash,  # x402 payment proof header
                    'X-Payment-Proof': tx_hash,  # Alternative header format
                    'X-Payment-Hash': tx_hash    # Another common format
                },
                timeout=120
            )
            
            log(f"Response status: {response.status_code}", "INFO")
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    log(f"Error response: {error_data}", "ERROR")
                except:
                    log(f"Error response text: {response.text}", "ERROR")
            
            if response.status_code == 200:
                data = response.json()
                log("Access granted!", "SUCCESS")
                log(f"   IP: {data.get('ip', 'unknown')}", "INFO")
                log(f"   Status: {data.get('status', 'unknown')}", "INFO")
                if 'rule_id' in data:
                    log(f"   Rule ID: {data['rule_id']}", "INFO")
                # Log transaction details if available
                if 'transaction' in data:
                    tx_info = data['transaction']
                    if 'hash' in tx_info:
                        log(f"   Transaction Hash: {tx_info['hash']}", "INFO")
                    if 'url' in tx_info:
                        log(f"   Transaction URL: {tx_info['url']}", "INFO")
                return True
            else:
                log(f"Failed after payment: {response.status_code}", "ERROR")
                return False
        
        elif response.status_code == 200:
            # Access granted (maybe already whitelisted)
            data = response.json()
            log("Access granted!", "SUCCESS")
            log(f"   IP: {data.get('ip', 'unknown')}", "INFO")
            log(f"   Status: {data.get('status', 'unknown')}", "INFO")
            return True
        
        else:
            # Other error
            log(f"Failed to purchase access: {response.status_code}", "ERROR")
            try:
                error_data = response.json()
                log(f"   Error: {error_data.get('error', 'unknown')}", "ERROR")
                log(f"   Message: {error_data.get('message', 'unknown')}", "ERROR")
            except:
                log(f"   Response: {response.text}", "ERROR")
            
            return False
            
    except requests.exceptions.Timeout:
        log("Request timed out - x402 payment may take longer", "ERROR")
        log("Please check the access server logs", "INFO")
        return False
    except Exception as e:
        log(f"Error purchasing access: {e}", "ERROR")
        import traceback
        traceback.print_exc()  # Print full error for debugging
        return False

def scrape(url):
    """
    Attempt to scrape the URL.
    Returns (success, content, status_code).
    """
    try:
        log(f"Scraping: {url}", "SCRAPE")
        
        response = requests.get(url, headers=BOT_HEADERS, timeout=30)
        
        log(f"Status: {response.status_code}", "INFO")
        
        if response.status_code == 200:
            log(f"Success! Got {len(response.text)} characters", "SUCCESS")
            return True, response.text, 200
        elif response.status_code == 402:
            log("Payment required (402)", "PAYMENT")
            try:
                payment_info = response.json()
                return False, payment_info, 402
            except:
                return False, None, 402
        else:
            log(f"Failed with status {response.status_code}", "ERROR")
            return False, None, response.status_code
            
    except Exception as e:
        log(f"Error: {e}", "ERROR")
        return False, None, 0

def extract_client_ip(payment_info):
    """
    Extract client IP from payment info response.
    """
    if not payment_info:
        return None
    
    # Try different possible locations for IP
    ip = (payment_info.get('client_ip') or 
          payment_info.get('user_context', {}).get('ip') or
          payment_info.get('ip'))
    
    return ip

def extract_domain_from_url(url):
    """
    Extract domain from URL.
    Examples:
    - https://test-cloudflare-website.adarsh.software/ -> test-cloudflare-website.adarsh.software
    - https://www.example.com/path -> www.example.com
    """
    from urllib.parse import urlparse
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return None
    # Return the full hostname (including subdomain)
    return hostname

# =============================================================================
# MAIN FLOW
# =============================================================================

def main():
    """Main scraping flow with x402 payment."""
    
    print("\n" + "=" * 80)
    print("SIMPLE BOT SCRAPER - x402 Payment Flow")
    print("=" * 80)
    print(f"Target: {CONFIG['target_url']}")
    print(f"Access Server: {CONFIG['access_server_url']}")
    print("-" * 80)
    print()
    
    # =========================================================================
    # STEP 1: Try to scrape (should get 402)
    # =========================================================================
    print("STEP 1: Initial scrape attempt")
    print("-" * 40)
    
    success, content, status = scrape(CONFIG['target_url'])
    
    if success:
        log("Unexpected success - paywall not active?", "INFO")
        log("Saving content anyway...", "SAVE")
        with open('scraped_content.html', 'w') as f:
            f.write(content)
        log("Saved to scraped_content.html", "SUCCESS")
        return 0
    
    if status != 402:
        log("Expected 402 Payment Required, got different error", "ERROR")
        return 1
    
    log("As expected, got blocked (needs payment)", "INFO")
    
    # Extract the client IP from the 402 response
    client_ip = extract_client_ip(content)
    if client_ip:
        log(f"Detected client IP: {client_ip}", "INFO")
    else:
        log("Could not detect client IP from response", "ERROR")
        log("Will let access server detect it", "INFO")
    
    # Extract domain from target URL
    target_domain = extract_domain_from_url(CONFIG['target_url'])
    if not target_domain:
        log("Could not extract domain from target URL", "ERROR")
        return 1
    
    log(f"Extracted domain: {target_domain}", "INFO")
    
    print()
    
    # =========================================================================
    # STEP 2: Get payment information
    # =========================================================================
    print("STEP 2: Getting payment information")
    print("-" * 40)
    
    payment_info = get_payment_info()
    if payment_info:
        log("Payment details:", "INFO")
        log(f"   Amount: {payment_info.get('amount_move', 'unknown')} MOVE", "INFO")
        log(f"   Address: {payment_info.get('payment_address', 'unknown')}", "INFO")
        log(f"   Network: {payment_info.get('network', 'unknown')}", "INFO")
    
    print()
    
    # =========================================================================
    # STEP 3: Purchase access (x402 payment + whitelisting)
    # =========================================================================
    print("STEP 3: Purchasing access")
    print("-" * 40)
    
    access_granted = buy_access(client_ip, target_domain)
    
    if not access_granted:
        log("Access not granted - check access server logs", "ERROR")
        log("Make sure:", "INFO")
        log("  1. Access server is running", "INFO")
        log("  2. You have sufficient MOVE tokens", "INFO")
        log("  3. Your wallet is configured correctly", "INFO")
        return 1
    
    print()
    
    # =========================================================================
    # STEP 4: Wait for whitelisting to propagate
    # =========================================================================
    print("STEP 4: Waiting for whitelisting to propagate")
    print("-" * 40)
    
    wait_time = CONFIG['wait_after_payment']
    log(f"Waiting {wait_time} seconds...", "WAIT")
    time.sleep(wait_time)
    
    # Check access status
    if client_ip:
        is_whitelisted = check_access_status(client_ip, target_domain)
        if is_whitelisted:
            log(f"IP {client_ip} is now whitelisted", "SUCCESS")
        else:
            log(f"IP {client_ip} not yet whitelisted (may need more time)", "INFO")
    
    print()
    
    # =========================================================================
    # STEP 5: Retry scrape (should succeed)
    # =========================================================================
    print("STEP 5: Retry scraping")
    print("-" * 40)
    
    for attempt in range(1, CONFIG['max_retries'] + 1):
        log(f"Attempt {attempt}/{CONFIG['max_retries']}", "INFO")
        
        success, content, status = scrape(CONFIG['target_url'])
        
        if success:
            print()
            print("=" * 80)
            print("SUCCESS!")
            print("=" * 80)
            log(f"Content length: {len(content)} characters", "INFO")
            
            # Save to file
            with open('scraped_content.html', 'w', encoding='utf-8') as f:
                f.write(content)
            log("Saved to scraped_content.html", "SAVE")
            
            # Show preview
            print()
            print("Content preview (first 300 chars):")
            print("-" * 40)
            print(content[:300])
            print("-" * 40)
            
            return 0
        
        if attempt < CONFIG['max_retries']:
            log(f"Still blocked, waiting {CONFIG['retry_delay']} seconds before retry...", "WAIT")
            time.sleep(CONFIG['retry_delay'])
    
    print()
    log("Still blocked after all retries!", "ERROR")
    log("Possible issues:", "INFO")
    log("  - Whitelisting not propagated yet (wait longer)", "INFO")
    log("  - Cloudflare cache not cleared", "INFO")
    log("  - Wrong IP detected", "INFO")
    log("  - Access server issue", "INFO")
    
    return 1

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    try:
        exit_code = main()
        exit(exit_code)
    except KeyboardInterrupt:
        print("\n")
        log("Interrupted by user", "INFO")
        exit(1)
    except Exception as e:
        print("\n")
        log(f"Unexpected error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        exit(1)