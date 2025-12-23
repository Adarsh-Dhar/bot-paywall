#!/usr/bin/env python3
"""
Test Cloudflare API connectivity and permissions
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def test_cloudflare_api():
    """Test basic Cloudflare API connectivity"""
    
    # Try to get token from environment or main project
    api_token = os.getenv('CLOUDFLARE_API_TOKEN')
    if not api_token:
        main_env_path = os.path.join(os.path.dirname(__file__), '..', 'main', '.env')
        if os.path.exists(main_env_path):
            with open(main_env_path, 'r') as f:
                for line in f:
                    if line.startswith('CLOUDFLARE_API_TOKEN='):
                        api_token = line.split('=', 1)[1].strip()
                        break
    
    if not api_token:
        print("❌ No API token found")
        return
    
    print(f"🔑 Using API token: {api_token[:10]}...")
    
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json'
    }
    
    # Test 1: Verify token
    print("\n🧪 Test 1: Verify token")
    try:
        response = requests.get('https://api.cloudflare.com/client/v4/user/tokens/verify', headers=headers)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('success'):
            print("✅ Token is valid")
        else:
            print("❌ Token verification failed")
            return
    except Exception as e:
        print(f"❌ Token verification error: {e}")
        return
    
    # Test 2: List zones
    print("\n🧪 Test 2: List zones")
    try:
        response = requests.get('https://api.cloudflare.com/client/v4/zones', headers=headers)
        print(f"Status: {response.status_code}")
        data = response.json()
        
        if data.get('success'):
            zones = data.get('result', [])
            print(f"✅ Found {len(zones)} zones:")
            for zone in zones:
                print(f"  - {zone['name']} (ID: {zone['id']})")
        else:
            print(f"❌ Failed to list zones: {data}")
    except Exception as e:
        print(f"❌ Zone listing error: {e}")
    
    # Test 3: Test specific zone
    zone_id = os.getenv('CLOUDFLARE_ZONE_ID', '11685346bf13dc3ffebc9cc2866a8105')
    print(f"\n🧪 Test 3: Test specific zone {zone_id}")
    try:
        response = requests.get(f'https://api.cloudflare.com/client/v4/zones/{zone_id}', headers=headers)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('success'):
            zone_info = data.get('result', {})
            print(f"✅ Zone found: {zone_info.get('name')}")
        else:
            print(f"❌ Zone access failed: {data}")
    except Exception as e:
        print(f"❌ Zone access error: {e}")
    
    # Test 4: Test firewall rules access
    print(f"\n🧪 Test 4: Test firewall rules access for zone {zone_id}")
    try:
        response = requests.get(f'https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/access_rules/rules', headers=headers)
        print(f"Status: {response.status_code}")
        data = response.json()
        
        if response.status_code == 200 and data.get('success'):
            rules = data.get('result', [])
            print(f"✅ Found {len(rules)} firewall rules")
            for rule in rules[:3]:  # Show first 3 rules
                print(f"  - {rule.get('configuration', {}).get('value')} ({rule.get('mode')})")
        else:
            print(f"❌ Firewall rules access failed: {data}")
            print(f"Status code: {response.status_code}")
    except Exception as e:
        print(f"❌ Firewall rules error: {e}")


if __name__ == "__main__":
    test_cloudflare_api()