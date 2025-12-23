#!/usr/bin/env python3
"""
Test with cache busting parameter
"""

import requests
import json
import time

def test_cache_bust():
    """Test with cache busting parameter"""
    
    # Add timestamp to bust cache
    timestamp = int(time.time())
    url = f"https://test-cloudflare-website.adarsh.software/?t={timestamp}"
    
    print(f"Testing with cache bust: {url}")
    
    response = requests.get(url, headers={
        'User-Agent': 'TestBot/1.0',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    })
    
    print(f"Status: {response.status_code}")
    print("Debug headers:")
    for key, value in response.headers.items():
        if key.startswith('X-Debug') or key.startswith('x-debug'):
            print(f"  {key}: {value}")
    
    print(f"\nFull response body:")
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        print(response.text)

if __name__ == "__main__":
    test_cache_bust()