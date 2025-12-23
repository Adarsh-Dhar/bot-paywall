#!/usr/bin/env python3
"""
Test a single request with transaction ID
"""

import requests
import time

def test_single_request():
    """Test a single request with transaction ID"""
    url = "https://test-cloudflare-website.adarsh.software/"
    tx_hash = "0xead22483c71638b1bdfab47f24a5b11c21830823cc83af4702ac0f31462feff4"
    
    print(f"Testing request with transaction ID: {tx_hash}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X402-Transaction-ID': tx_hash
    }
    
    print("Making request...")
    response = requests.get(url, headers=headers)
    
    print(f"Status: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    print(f"Response: {response.text[:500]}")

if __name__ == "__main__":
    test_single_request()