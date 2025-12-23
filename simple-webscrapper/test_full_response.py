#!/usr/bin/env python3
"""
Test full response to see debug info
"""

import requests
import json

def test_full_response():
    """Test full response to see debug info"""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    print("Testing full response...")
    
    response = requests.get(url, headers={
        'User-Agent': 'TestBot/1.0'
    })
    
    print(f"Status: {response.status_code}")
    print("All headers:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")
    
    print(f"\nFull response body:")
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        print(response.text)

if __name__ == "__main__":
    test_full_response()