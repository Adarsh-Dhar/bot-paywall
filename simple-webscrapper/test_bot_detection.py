#!/usr/bin/env python3
"""
Test bot detection with different user agents
"""

import requests

def test_bot_detection():
    """Test bot detection with different user agents"""
    url = "https://test-cloudflare-website.adarsh.software/"
    
    test_cases = [
        {
            "name": "Browser-like (should not be detected as bot)",
            "headers": {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            }
        },
        {
            "name": "Python requests (should be detected as bot)",
            "headers": {
                'User-Agent': 'python-requests/2.31.0',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
            }
        },
        {
            "name": "Obvious bot (should be detected as bot)",
            "headers": {
                'User-Agent': 'MyBot/1.0',
                'Accept': '*/*',
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n=== {test_case['name']} ===")
        response = requests.get(url, headers=test_case['headers'])
        print(f"Status: {response.status_code}")
        
        if response.status_code == 402:
            print("✅ Detected as bot (payment required)")
        elif response.status_code == 200:
            print("✅ Not detected as bot (access granted)")
        else:
            print(f"❓ Unexpected status: {response.status_code}")

if __name__ == "__main__":
    test_bot_detection()