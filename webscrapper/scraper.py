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

def check_access_status(ip):
    """
    Check if IP is whitelisted.
    """
    try:
        response = requests.get(
            f"{CONFIG['access_server_url']}/check-access/{ip}",
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
    Make actual MOVE token payment.
    You'll need to integrate with Movement blockchain here.
    """
    # This is pseudocode - implement with your Movement SDK
    from aptos_sdk import Account, RestClient
    
    # Load your wallet
    account = Account.load_key("YOUR_PRIVATE_KEY")
    client = RestClient("MOVEMENT_RPC_URL")
    
    # Create and submit transaction
    txn_hash = client.transfer(
        account,
        payment_address,
        amount
    )
    
    return txn_hash        

def buy_access(scraper_ip):
    try:
        # First attempt - will get 402 with payment instructions
        response = requests.post(
            f"{CONFIG['access_server_url']}/buy-access",
            json={'scraper_ip': scraper_ip},
            timeout=120
        )
        
        if response.status_code == 402:
            # Extract payment details from x402 response
            payment_header = response.headers.get('X-PAYMENT-RESPONSE')
            payment_data = response.json()
            
            log("Making blockchain payment...", "PAYMENT")
            
            # FIX: Extract payment info from the correct structure
            # The 402 response has a different structure than /payment-info
            payment_context = payment_data.get('payment_context', {})
            
            # Get payment address and amount
            payment_address = payment_context.get('address')
            amount = payment_context.get('amount')
            
            if not payment_address or not amount:
                log(f"Invalid payment data: {payment_data}", "ERROR")
                return False
            
            log(f"Payment Address: {payment_address}", "INFO")
            log(f"Amount: {amount} MOVE", "INFO")
            
            # MAKE ACTUAL PAYMENT
            tx_hash = make_blockchain_payment(payment_address, amount)
            
            log(f"Payment made: {tx_hash}", "SUCCESS")
            
            # Retry request WITH PAYMENT PROOF
            response = requests.post(
                f"{CONFIG['access_server_url']}/buy-access",
                json={
                    'scraper_ip': scraper_ip,
                    'tx_hash': tx_hash  # Include payment proof
                },
                headers={
                    'X-PAYMENT-PROOF': tx_hash  # x402 payment proof header
                },
                timeout=120
            )
            
            if response.status_code == 200:
                data = response.json()
                log("Access granted!", "SUCCESS")
                log(f"   IP: {data.get('ip', 'unknown')}", "INFO")
                log(f"   Status: {data.get('status', 'unknown')}", "INFO")
                if 'rule_id' in data:
                    log(f"   Rule ID: {data['rule_id']}", "INFO")
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
    try:
        # First attempt - will get 402 with payment instructions
        response = requests.post(
            f"{CONFIG['access_server_url']}/buy-access",
            json={'scraper_ip': scraper_ip},
            timeout=120
        )
        
        if response.status_code == 402:
            # Extract payment details from x402 response
            payment_header = response.headers.get('X-PAYMENT-RESPONSE')
            payment_data = response.json()
            
            log("Making blockchain payment...", "PAYMENT")
            
            # MAKE ACTUAL PAYMENT
            tx_hash = make_blockchain_payment(
                payment_data['payment_address'],
                payment_data['amount']
            )
            
            log(f"Payment made: {tx_hash}", "SUCCESS")
            
            # Retry request WITH PAYMENT PROOF
            response = requests.post(
                f"{CONFIG['access_server_url']}/buy-access",
                json={
                    'scraper_ip': scraper_ip,
                    'tx_hash': tx_hash  # Include payment proof
                },
                headers={
                    'X-PAYMENT-PROOF': tx_hash  # x402 payment proof header
                },
                timeout=120
            )
            
            if response.status_code == 200:
                log("Access granted!", "SUCCESS")
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
    
    access_granted = buy_access(client_ip)
    
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
        is_whitelisted = check_access_status(client_ip)
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