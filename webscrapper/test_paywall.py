#!/usr/bin/env python3
"""
Simple test script to check if the paywall is working
"""
import requests

TARGET_URL = "https://test-cloudflare-website.adarsh.software/"
SECRET_HANDSHAKE = "open-sesame-move-2025"

def test_paywall():
    print(f"Testing paywall at: {TARGET_URL}")
    
    # Test 1: Access without any headers (should get 403 from Cloudflare WAF)
    print("\n1. Testing access without headers...")
    try:
        r = requests.get(TARGET_URL)
        print(f"   Status: {r.status_code}")
        if r.status_code == 403:
            print("   ✅ Cloudflare WAF is blocking (expected)")
        else:
            print(f"   ⚠️ Unexpected response: {r.text[:100]}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Access with secret handshake (should get 402 from Worker)
    print("\n2. Testing access with secret handshake...")
    headers = {
        "x-secret-handshake": SECRET_HANDSHAKE,
        "User-Agent": "Movement-Scraper/1.0"
    }
    
    try:
        r = requests.get(TARGET_URL, headers=headers)
        print(f"   Status: {r.status_code}")
        if r.status_code == 402:
            print("   ✅ Worker is requesting payment (expected)")
            try:
                data = r.json()
                print(f"   Payment details: {data}")
            except:
                print(f"   Response: {r.text}")
        elif r.status_code == 200:
            print("   ⚠️ Site is open without payment!")
            print(f"   Content: {r.text[:200]}")
        else:
            print(f"   ❌ Unexpected status: {r.text[:100]}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Access with fake payment hash
    print("\n3. Testing access with fake payment hash...")
    headers_with_payment = {
        "x-secret-handshake": SECRET_HANDSHAKE,
        "X-Payment-Hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "User-Agent": "Movement-Scraper/1.0"
    }
    
    try:
        r = requests.get(TARGET_URL, headers=headers_with_payment)
        print(f"   Status: {r.status_code}")
        if r.status_code == 403:
            print("   ✅ Worker rejected fake payment (expected)")
        elif r.status_code == 500:
            print("   ⚠️ RPC error when verifying payment")
        else:
            print(f"   Response: {r.text[:100]}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    test_paywall()