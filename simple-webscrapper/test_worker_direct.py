#!/usr/bin/env python3
"""
Test worker directly via workers.dev subdomain
"""

import requests
import json

def test_worker_direct():
    """Test worker directly via workers.dev subdomain"""
    
    # Try the workers.dev URL
    worker_url = "https://paywall-worker.dharadarsh0.workers.dev/"
    
    print(f"Testing worker directly: {worker_url}")
    
    response = requests.get(worker_url, headers={
        'User-Agent': 'TestBot/1.0',
        'X402-Transaction-ID': 'test-transaction-123'
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
    test_worker_direct()