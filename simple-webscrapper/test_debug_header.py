#!/usr/bin/env python3
"""
Test debug header functionality
"""

import requests

def test_debug_header():
    """Test debug header functionality"""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    print("Testing debug header...")
    
    response = requests.get(url, headers={
        'User-Agent': 'TestBot/1.0'
    })
    
    print(f"Status: {response.status_code}")
    print("All headers:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")
    
    print(f"\nResponse body: {response.text}")

if __name__ == "__main__":
    test_debug_header()