#!/usr/bin/env python3
"""
Test what happens when the worker tries to verify a payment with the new RPC
"""
import requests

TARGET_URL = "https://test-cloudflare-website.adarsh.software/"
SECRET_HANDSHAKE = "open-sesame-move-2025"

def test_worker_rpc():
    print("🧪 Testing Worker RPC verification with new endpoint")
    
    # Test with a real-looking transaction hash
    fake_tx_hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    
    headers = {
        "x-secret-handshake": SECRET_HANDSHAKE,
        "X-Payment-Hash": fake_tx_hash,
        "User-Agent": "Movement-Scraper/1.0"
    }
    
    print(f"📡 Sending request with fake tx hash: {fake_tx_hash}")
    
    try:
        r = requests.get(TARGET_URL, headers=headers)
        print(f"📊 Status: {r.status_code}")
        print(f"📄 Response: {r.text}")
        
        if r.status_code == 500:
            print("⚠️ Worker is getting RPC errors (expected with new endpoint)")
        elif r.status_code == 403:
            print("✅ Worker successfully rejected fake payment")
        elif r.status_code == 200:
            print("❌ Worker incorrectly accepted fake payment")
        else:
            print(f"❓ Unexpected response: {r.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_worker_rpc()