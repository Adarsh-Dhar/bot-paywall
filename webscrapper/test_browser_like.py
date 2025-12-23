#!/usr/bin/env python3
"""
Test accessing the website with browser-like headers to see if we can bypass bot detection
"""

import requests
from datetime import datetime

def test_browser_access():
    """Test with very browser-like headers"""
    
    url = "https://test-cloudflare-website.adarsh.software/"
    
    # Very detailed browser headers
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
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"'
    }
    
    print(f"[{datetime.now()}] Testing browser-like access to: {url}")
    print("Headers being sent:")
    for key, value in headers.items():
        print(f"  {key}: {value}")
    print("-" * 50)
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"[{datetime.now()}] Response status: {response.status_code}")
        print(f"[{datetime.now()}] Response headers:")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")
        
        print(f"\n[{datetime.now()}] Response content:")
        print("=" * 80)
        print(response.text)
        print("=" * 80)
        
        if response.status_code == 200:
            print(f"\n[{datetime.now()}] ✅ SUCCESS! Got 200 response")
            if "To get started, edit the page.tsx file" in response.text:
                print(f"[{datetime.now()}] 🎉 Found expected content - bot detection bypassed!")
            else:
                print(f"[{datetime.now()}] ⚠️ Got 200 but content doesn't match expected")
        elif response.status_code == 402:
            print(f"\n[{datetime.now()}] 💳 Payment required (402)")
        elif response.status_code == 403:
            print(f"\n[{datetime.now()}] 🚫 Access forbidden (403)")
        else:
            print(f"\n[{datetime.now()}] ❓ Unexpected status: {response.status_code}")
            
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error: {e}")

if __name__ == "__main__":
    test_browser_access()