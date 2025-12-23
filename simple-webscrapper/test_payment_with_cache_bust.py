#!/usr/bin/env python3
"""
Test payment verification with cache busting
"""

import requests
import json
import time

def test_payment_with_cache_bust():
    """Test payment verification with cache busting"""
    
    # Use the latest transaction ID from the scraper
    tx_hash = "0x6184e713e1cbea17afe39a2ffe09751aa61c20b7bad1f3b063813c438f5ae17b"
    
    # Add timestamp to bust cache
    timestamp = int(time.time())
    url = f"https://test-cloudflare-website.adarsh.software/?t={timestamp}"
    
    print(f"Testing payment verification with cache bust: {url}")
    print(f"Transaction ID: {tx_hash}")
    
    response = requests.get(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X402-Transaction-ID': tx_hash,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    })
    
    print(f"Status: {response.status_code}")
    print("Debug headers:")
    for key, value in response.headers.items():
        if key.startswith('X-Debug') or key.startswith('x-debug'):
            print(f"  {key}: {value}")
    
    if response.status_code == 200:
        print("✅ Payment verification successful!")
        print(f"Response length: {len(response.text)}")
    else:
        print("❌ Payment verification failed")
        print(f"Response: {response.text[:500]}")

if __name__ == "__main__":
    test_payment_with_cache_bust()