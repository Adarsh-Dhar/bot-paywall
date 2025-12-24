#!/usr/bin/env python3
"""
Simple Bot Scraper - Tests HTTP 402 Payment Flow
This scraper intentionally identifies as a bot to test the paywall.
"""

import requests
import json
import time
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    # Target website
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    
    # Access server
    'access_server_url': 'http://localhost:5000/buy-access',
    
    # Payment details (Aptos/Movement blockchain)
    'payment_address': '0xdb466d22253732426f60d1a9ce33b080cf44160ed383277e399160ffdcc70b05',
    'payment_amount': '0.01',  # MOVE tokens
    'payment_amount_octas': 1000000,  # 0.01 MOVE = 1,000,000 octas
    
    # Wallet (for making payment)
    'private_key': '0xafcc93f1f5bf61dadb43da473273a900754b12714243e3aa6124dfee14341871',
    
    # Retry settings
    'max_retries': 3,
    'wait_after_payment': 5  # seconds
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

def make_payment(payment_address, amount_octas):
    """
    Make payment on blockchain.
    Returns transaction hash or None if failed.
    """
    try:
        from aptos_sdk.account import Account
        from aptos_sdk.client import RestClient
        from aptos_sdk.transactions import EntryFunction, TransactionArgument, TypeTag, StructTag
        from aptos_sdk.bcs import Serializer
        
        print(f"[{datetime.now()}] 💰 Making payment...")
        print(f"   Amount: {amount_octas} octas ({amount_octas/100000000} MOVE)")
        print(f"   To: {payment_address}")
        
        # Initialize client
        client = RestClient("https://fullnode.mainnet.aptoslabs.com/v1")
        
        # Load account
        account = Account.load_key(CONFIG['private_key'])
        print(f"   From: {account.address()}")
        
        # Create transfer transaction
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
        signed_txn = client.create_bcs_signed_transaction(account, payload)
        tx_hash = client.submit_bcs_transaction(signed_txn)
        
        # Wait for confirmation
        print(f"[{datetime.now()}] ⏳ Waiting for confirmation...")
        client.wait_for_transaction(tx_hash)
        
        print(f"[{datetime.now()}] ✅ Payment successful!")
        print(f"   TX Hash: {tx_hash}")
        return tx_hash
        
    except ImportError:
        print(f"[{datetime.now()}] ❌ Aptos SDK not installed")
        print("Install: pip install aptos-sdk")
        return None
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Payment failed: {e}")
        return None

def submit_payment_to_server(tx_hash, client_ip=None):
    """
    Submit payment proof to access server.
    Returns True if access granted.
    """
    try:
        print(f"[{datetime.now()}] 🔑 Submitting payment to access server...")
        
        payload = {'tx_hash': tx_hash}
        if client_ip:
            payload['scraper_ip'] = client_ip
        
        response = requests.post(
            CONFIG['access_server_url'],
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"[{datetime.now()}] ✅ Access granted!")
            print(f"   Expires in: {data.get('expires_in', 'unknown')}")
            return True
        else:
            print(f"[{datetime.now()}] ❌ Access denied")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error: {e}")
        return False

def scrape(url):
    """
    Attempt to scrape the URL.
    Returns content if successful, None otherwise.
    """
    try:
        print(f"[{datetime.now()}] 🔍 Scraping: {url}")
        
        response = requests.get(url, headers=BOT_HEADERS, timeout=30)
        
        print(f"[{datetime.now()}] Status: {response.status_code}")
        
        if response.status_code == 200:
            print(f"[{datetime.now()}] ✅ Success! Got {len(response.text)} characters")
            return response.text
        elif response.status_code == 402:
            print(f"[{datetime.now()}] 💳 Payment required (402)")
            return None
        else:
            print(f"[{datetime.now()}] ❌ Failed with status {response.status_code}")
            return None
            
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error: {e}")
        return None

# =============================================================================
# MAIN FLOW
# =============================================================================

def main():
    """Main scraping flow with payment."""
    
    print("=" * 80)
    print("SIMPLE BOT SCRAPER - Payment Flow Test")
    print("=" * 80)
    print(f"Target: {CONFIG['target_url']}")
    print(f"Access Server: {CONFIG['access_server_url']}")
    print(f"Payment: {CONFIG['payment_amount']} MOVE")
    print("-" * 80)
    print()
    
    # =========================================================================
    # STEP 1: Try to scrape (should get 402)
    # =========================================================================
    print("STEP 1: Initial scrape attempt")
    print("-" * 40)
    
    content = scrape(CONFIG['target_url'])
    
    if content:
        print("\n[{datetime.now()}] ⚠️  Unexpected success - paywall not active?")
        print("Saving content anyway...")
        with open('scraped_content.html', 'w') as f:
            f.write(content)
        return 0
    
    print(f"[{datetime.now()}] ℹ️  As expected, got blocked (needs payment)")
    print()
    
    # =========================================================================
    # STEP 2: Make payment
    # =========================================================================
    print("STEP 2: Making payment")
    print("-" * 40)
    
    tx_hash = make_payment(
        CONFIG['payment_address'],
        CONFIG['payment_amount_octas']
    )
    
    if not tx_hash:
        print(f"[{datetime.now()}] ❌ Payment failed, cannot continue")
        return 1
    
    print()
    
    # =========================================================================
    # STEP 3: Submit to access server
    # =========================================================================
    print("STEP 3: Submitting payment proof")
    print("-" * 40)
    
    # Get the payment info to extract client IP
    response = requests.get(CONFIG['target_url'], headers=BOT_HEADERS)
    client_ip = None
    if response.status_code == 402:
        try:
            payment_info = response.json()
            client_ip = payment_info.get('client_ip') or payment_info.get('user_context', {}).get('ip')
            print(f"[{datetime.now()}] 📍 Detected IP: {client_ip}")
        except:
            pass
    
    access_granted = submit_payment_to_server(tx_hash, client_ip)
    
    if not access_granted:
        print(f"[{datetime.now()}] ❌ Access not granted, cannot continue")
        return 1
    
    print()
    
    # =========================================================================
    # STEP 4: Wait for whitelisting
    # =========================================================================
    print("STEP 4: Waiting for whitelisting to propagate")
    print("-" * 40)
    
    wait_time = CONFIG['wait_after_payment']
    print(f"[{datetime.now()}] ⏳ Waiting {wait_time} seconds...")
    time.sleep(wait_time)
    print()
    
    # =========================================================================
    # STEP 5: Retry scrape (should succeed)
    # =========================================================================
    print("STEP 5: Retry scraping")
    print("-" * 40)
    
    content = scrape(CONFIG['target_url'])
    
    if content:
        print()
        print("=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"Content length: {len(content)} characters")
        
        # Save to file
        with open('scraped_content.html', 'w') as f:
            f.write(content)
        print(f"[{datetime.now()}] 💾 Saved to scraped_content.html")
        
        # Show preview
        print()
        print("Content preview (first 300 chars):")
        print("-" * 40)
        print(content[:300])
        print("-" * 40)
        
        return 0
    else:
        print()
        print(f"[{datetime.now()}] ❌ Still blocked after payment!")
        print("Possible issues:")
        print("  - Whitelisting not propagated yet (wait longer)")
        print("  - Access server not running")
        print("  - Wrong IP detected")
        return 1

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    try:
        exit_code = main()
        exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n[{datetime.now()}] ⚠️  Interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n[{datetime.now()}] ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)