#!/usr/bin/env python3
"""
Webscraper with HTTP 402 payment support for Cloudflare-protected sites.
"""

import requests
from datetime import datetime
import sys
import json
import time

# Configuration
SCRAPER_CONFIG = {
    'target_url': 'https://test-cloudflare-website.adarsh.software/',
    'access_server_url': 'http://localhost:3000/buy-access',
    'aptos_wallet_private_key': 'YOUR_PRIVATE_KEY_HERE',  # Store securely!
    'payment_destination': '0xYOUR_WALLET_ADDRESS_HERE',
    'max_retries': 3,
    'retry_delay': 5
}

class PaymentRequiredException(Exception):
    """Raised when 402 Payment Required is returned"""
    pass

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
        from aptos_sdk.transactions import EntryFunction, TransactionArgument
        from aptos_sdk.bcs import Serializer
        
        # Initialize Aptos client
        rest_client = RestClient("https://fullnode.mainnet.aptoslabs.com/v1")
        
        # Load account from private key
        # SECURITY: Never hardcode private keys, use environment variables
        account = Account.load_key(SCRAPER_CONFIG['aptos_wallet_private_key'])
        
        print(f"[{datetime.now()}] 💰 Initiating payment of {amount_octas} octas to {payment_address}")
        
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
        txn_hash = rest_client.submit_transaction(account, payload)
        
        # Wait for transaction confirmation
        print(f"[{datetime.now()}] ⏳ Waiting for transaction confirmation...")
        rest_client.wait_for_transaction(txn_hash)
        
        print(f"[{datetime.now()}] ✅ Payment successful! Transaction hash: {txn_hash}")
        return txn_hash
        
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Payment failed: {e}")
        return None

def request_access(tx_hash, scraper_ip=None):
    """
    Submit payment proof to access server to get IP whitelisted.
    
    Args:
        tx_hash (str): Aptos transaction hash
        scraper_ip (str, optional): IP address to whitelist (auto-detected if None)
    
    Returns:
        bool: True if access granted, False otherwise
    """
    try:
        print(f"[{datetime.now()}] 🔑 Requesting access with transaction: {tx_hash}")
        
        payload = {
            'tx_hash': tx_hash
        }
        
        if scraper_ip:
            payload['scraper_ip'] = scraper_ip
        
        response = requests.post(
            SCRAPER_CONFIG['access_server_url'],
            json=payload,
            timeout=30
        )
        
        print(f"[{datetime.now()}] Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[{datetime.now()}] ✅ Access granted! Expires in: {data.get('expires_in', 'unknown')}")
            return True
        else:
            print(f"[{datetime.now()}] ❌ Access denied: {response.text}")
            return False
            
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error requesting access: {e}")
        return False

def scrape_website(url):
    """
    Scrape the given URL with HTTP 402 payment support.
    
    Args:
        url (str): The URL to scrape
    
    Returns:
        str: The page content or None if failed
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    }
    
    try:
        print(f"[{datetime.now()}] 🔍 Starting to scrape: {url}")
        
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"[{datetime.now()}] Response status code: {response.status_code}")
        
        # Check for 402 Payment Required
        if response.status_code == 402:
            print(f"\n[{datetime.now()}] 💳 HTTP 402 PAYMENT REQUIRED")
            
            try:
                payment_info = response.json()
                print(f"Payment Details:")
                print(f"  Address: {payment_info.get('payment_address')}")
                print(f"  Amount: {payment_info.get('payment_amount')} {payment_info.get('payment_currency')}")
                print(f"  Your IP: {payment_info.get('client_ip')}")
                
                # Make payment
                tx_hash = make_aptos_payment(
                    payment_info.get('payment_address'),
                    1000000  # 0.01 MOVE = 1,000,000 octas
                )
                
                if not tx_hash:
                    print(f"[{datetime.now()}] ❌ Payment failed")
                    return None
                
                # Request access
                if not request_access(tx_hash, payment_info.get('client_ip')):
                    print(f"[{datetime.now()}] ❌ Access request failed")
                    return None
                
                # Wait a moment for whitelisting to propagate
                print(f"[{datetime.now()}] ⏳ Waiting for access to propagate...")
                time.sleep(3)
                
                # Retry the request
                print(f"[{datetime.now()}] 🔄 Retrying scrape after payment...")
                response = requests.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    print(f"[{datetime.now()}] ✅ Access granted after payment!")
                else:
                    print(f"[{datetime.now()}] ❌ Still blocked after payment. Status: {response.status_code}")
                    return None
                    
            except json.JSONDecodeError:
                print(f"[{datetime.now()}] ❌ Invalid JSON in 402 response")
                return None
        
        # Check for Cloudflare challenge
        elif "Just a moment..." in response.text or "cf-mitigated: challenge" in str(response.headers):
            print(f"\n[{datetime.now()}] ⚠️ Cloudflare challenge detected")
            print("This might be additional bot protection beyond the paywall")
            return None
        
        # Success!
        elif response.status_code == 200:
            print(f"\n[{datetime.now()}] ✅ SCRAPING SUCCESSFUL!")
            print(f"Content length: {len(response.text)} characters")
            print("=" * 80)
            print(response.text[:500])  # Print first 500 chars
            print("=" * 80)
            return response.text
        
        else:
            print(f"[{datetime.now()}] ❌ Unexpected status code: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now()}] ❌ Error occurred: {e}")
        return None

def main():
    """Main function to run the scraper."""
    url = SCRAPER_CONFIG['target_url']
    
    print("=" * 80)
    print("HTTP 402 Payment-Enabled Web Scraper")
    print("=" * 80)
    print(f"Target URL: {url}")
    print(f"Access Server: {SCRAPER_CONFIG['access_server_url']}")
    print("-" * 80)
    
    # Scrape the website
    content = scrape_website(url)
    
    if content:
        print(f"\n[{datetime.now()}] ✅ Scraping completed successfully!")
        
        # Optional: Save to file
        with open('scraped_content.html', 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[{datetime.now()}] 💾 Content saved to scraped_content.html")
    else:
        print(f"\n[{datetime.now()}] ❌ Scraping failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()