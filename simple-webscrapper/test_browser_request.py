#!/usr/bin/env python3
"""
Test browser-like request that should go to origin
"""

import requests

def test_browser_request():
    """Test browser-like request that should go to origin"""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    print("Testing browser-like request...")
    
    # Use very browser-like headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    }
    
    response = requests.get(url, headers=headers)
    
    print(f"Status: {response.status_code}")
    print("Debug headers:")
    for key, value in response.headers.items():
        if key.startswith('X-Debug') or key.startswith('x-debug'):
            print(f"  {key}: {value}")
    
    print(f"\nResponse length: {len(response.text)}")
    print(f"Response preview: {response.text[:200]}")

if __name__ == "__main__":
    test_browser_request()