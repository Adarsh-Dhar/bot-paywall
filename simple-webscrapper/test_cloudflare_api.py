#!/usr/bin/env python3
"""
Test Cloudflare API to check whitelist rules
"""

import requests
import json
import os

def test_cloudflare_api():
    """Test Cloudflare API to check whitelist rules"""
    
    # Configuration from worker
    zone_id = "11685346bf13dc3ffebc9cc2866a8105"
    api_token = "oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
    
    # Test IP (this should be your current IP)
    test_ip = "210.212.2.133"  # From the .env file
    
    print(f"Testing Cloudflare API for zone: {zone_id}")
    print(f"Checking IP: {test_ip}")
    
    # Check existing whitelist rules
    print("\n=== Checking existing whitelist rules ===")
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/access_rules/rules"
    
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.ok:
        data = response.json()
        print(f"API call successful: {data.get('success')}")
        print(f"Total rules: {len(data.get('result', []))}")
        
        # Check for our IP
        for rule in data.get('result', []):
            if rule.get('configuration', {}).get('value') == test_ip:
                print(f"✅ Found rule for IP {test_ip}:")
                print(f"  Mode: {rule.get('mode')}")
                print(f"  ID: {rule.get('id')}")
                print(f"  Notes: {rule.get('notes')}")
                return
        
        print(f"❌ No existing rule found for IP {test_ip}")
        
        # Show all rules for debugging
        print("\nAll existing rules:")
        for rule in data.get('result', []):
            config = rule.get('configuration', {})
            print(f"  {rule.get('mode')} - {config.get('target')}: {config.get('value')} (ID: {rule.get('id')})")
    else:
        print(f"❌ API call failed: {response.status_code}")
        print(f"Response: {response.text}")
    
    # Test creating a whitelist rule
    print(f"\n=== Testing whitelist rule creation for IP {test_ip} ===")
    create_url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/access_rules/rules"
    
    payload = {
        "mode": "whitelist",
        "configuration": {
            "target": "ip",
            "value": test_ip
        },
        "notes": "Test X402 Payment"
    }
    
    create_response = requests.post(create_url, headers=headers, json=payload)
    
    if create_response.ok:
        result = create_response.json()
        print(f"✅ Whitelist rule created successfully")
        print(f"Rule ID: {result.get('result', {}).get('id')}")
    else:
        print(f"❌ Failed to create whitelist rule: {create_response.status_code}")
        print(f"Response: {create_response.text}")

if __name__ == "__main__":
    test_cloudflare_api()