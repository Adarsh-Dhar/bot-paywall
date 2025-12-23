#!/usr/bin/env python3
"""
Test script to verify IP-based access control is working properly.
This simulates requests from different IP addresses to test the 403 Forbidden functionality.
"""

import requests
import json

def test_ip_access_control():
    """Test the IP-based access control system"""
    url = "http://localhost:4402/api/premium-content"
    
    print("🧪 Testing IP-based access control system")
    print("=" * 50)
    
    # Test 1: Request without payment proof (should get 402)
    print("\n1. Testing request without payment proof:")
    try:
        response = requests.get(url, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 402:
            print("   ✅ Correctly returned 402 Payment Required")
        else:
            print(f"   ❌ Expected 402, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Request with reused payment proof from different IP (should get 403)
    print("\n2. Testing request with reused payment proof from different IP:")
    
    # First, make a payment from one IP
    real_proof = {
        "transactionHash": "0xe2bb9590cd007434e9aaa4936b3e3b9f5e9c3f09856976f9f8451356216390b9",
        "network": "movement",
        "asset": "0x1::aptos_coin::AptosCoin"
    }
    
    headers_ip1 = {
        'X-Payment-Proof': json.dumps(real_proof),
        'X-Forwarded-For': '192.168.1.100'  # First IP
    }
    
    print("   a) Making payment from IP 192.168.1.100:")
    try:
        response = requests.get(url, headers=headers_ip1, timeout=10, allow_redirects=False)
        print(f"      Status: {response.status_code}")
        if response.status_code in [200, 302]:
            print("      ✅ Payment accepted, IP whitelisted")
        else:
            print(f"      ❌ Expected 200/302, got {response.status_code}")
    except Exception as e:
        print(f"      ❌ Error: {e}")
    
    # Now try to reuse the same payment from a different IP
    headers_ip2 = {
        'X-Payment-Proof': json.dumps(real_proof),
        'X-Forwarded-For': '192.168.1.200'  # Different IP
    }
    
    print("   b) Trying to reuse same payment from IP 192.168.1.200:")
    try:
        response = requests.get(url, headers=headers_ip2, timeout=10)
        print(f"      Status: {response.status_code}")
        if response.status_code == 403:
            print("      ✅ Correctly returned 403 Forbidden")
            try:
                error_data = response.json()
                print(f"      Message: {error_data.get('message', 'No message')}")
            except:
                pass
        else:
            print(f"      ❌ Expected 403, got {response.status_code}")
    except Exception as e:
        print(f"      ❌ Error: {e}")
    
    # Test 3: Request from whitelisted IP (should get 200/redirect)
    print("\n3. Testing request from whitelisted IP (192.168.1.100):")
    headers_whitelisted = {
        'X-Forwarded-For': '192.168.1.100'  # Previously whitelisted IP
    }
    try:
        response = requests.get(url, headers=headers_whitelisted, timeout=10, allow_redirects=False)
        print(f"   Status: {response.status_code}")
        if response.status_code in [200, 302]:
            print("   ✅ Correctly granted access to whitelisted IP")
        else:
            print(f"   ❌ Expected 200/302, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 Test completed!")

if __name__ == "__main__":
    test_ip_access_control()