#!/usr/bin/env python3
"""
Test basic worker functionality
"""

import requests

def test_worker_basic():
    """Test basic worker functionality"""
    
    test_urls = [
        "https://test-cloudflare-website.adarsh.software/",
        "https://test-cloudflare-website.adarsh.software/test",
        "https://test-cloudflare-website.adarsh.software/debug"
    ]
    
    for url in test_urls:
        print(f"\n=== Testing {url} ===")
        
        response = requests.get(url, headers={
            'User-Agent': 'TestBot/1.0'
        })
        
        print(f"Status: {response.status_code}")
        print("Headers:")
        for key, value in response.headers.items():
            if key.startswith('X-') or key.startswith('x-'):
                print(f"  {key}: {value}")
        
        print(f"Response: {response.text[:200]}")

if __name__ == "__main__":
    test_worker_basic()