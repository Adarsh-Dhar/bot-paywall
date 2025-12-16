#!/usr/bin/env python3
"""
Simplified webscraper that demonstrates the paywall concept
without requiring a working blockchain RPC
"""
import requests
import time
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

TARGET_URL = os.getenv("TARGET_URL", "https://test-cloudflare-website.adarsh.software/")
SECRET_HANDSHAKE = "open-sesame-move-2025"

def scrape_with_mock_payment():
    print(f"🎯 Target: {TARGET_URL}")
    print("🔧 Using mock payment for demonstration")
    
    # Step 1: Check if paywall is active
    print("\n1️⃣ Checking paywall status...")
    headers = {
        "x-secret-handshake": SECRET_HANDSHAKE,
        "User-Agent": "Movement-Scraper/1.0"
    }
    
    r = requests.get(TARGET_URL, headers=headers)
    
    if r.status_code == 200:
        print("✅ Site is open! No payment needed.")
        print("📄 Content:")
        print("-" * 50)
        print(r.text)
        return
    
    if r.status_code != 402:
        print(f"❌ Unexpected status: {r.status_code}")
        print(r.text)
        return
    
    # Step 2: Parse payment requirements
    print("💰 Payment required! Parsing details...")
    try:
        payment_info = r.json()
        print(f"   💵 Amount: {payment_info['price_move']} MOVE")
        print(f"   📍 Address: {payment_info['payment_address']}")
        print(f"   🔗 Chain ID: {payment_info['chain_id']}")
    except Exception as e:
        print(f"❌ Failed to parse payment info: {e}")
        return
    
    # Step 3: Simulate payment (in real scenario, this would be a blockchain transaction)
    print("\n2️⃣ Simulating payment...")
    print("⏳ Creating mock transaction...")
    time.sleep(2)  # Simulate transaction time
    
    # Mock transaction hash (in real scenario, this would come from the blockchain)
    mock_tx_hash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    print(f"✅ Mock transaction created: {mock_tx_hash}")
    
    # Step 4: Access with payment proof
    print("\n3️⃣ Accessing content with payment proof...")
    payment_headers = {
        "x-secret-handshake": SECRET_HANDSHAKE,
        "X-Payment-Hash": mock_tx_hash,
        "User-Agent": "Movement-Scraper/1.0"
    }
    
    final_r = requests.get(TARGET_URL, headers=payment_headers)
    
    if final_r.status_code == 200:
        print("🎉 SUCCESS! Payment accepted, content retrieved:")
        print("-" * 50)
        print(final_r.text)
        print("-" * 50)
    elif final_r.status_code == 403:
        print("❌ Payment verification failed")
        print("   This is expected with a mock transaction hash")
        print("   In a real scenario, you would need a valid blockchain transaction")
    else:
        print(f"❌ Unexpected response: {final_r.status_code}")
        print(final_r.text)

def test_real_payment_flow():
    """
    This function shows what a real payment would look like
    (commented out due to RPC issues)
    """
    print("\n" + "="*60)
    print("📋 REAL PAYMENT FLOW (for reference)")
    print("="*60)
    print("In a real scenario with working RPC endpoints:")
    print("1. Connect to Movement blockchain RPC")
    print("2. Check wallet balance")
    print("3. Create and sign transaction")
    print("4. Send transaction to blockchain")
    print("5. Wait for confirmation")
    print("6. Use transaction hash as payment proof")
    print("7. Access protected content")
    print("\n💡 Current issue: Movement RPC endpoints are not responding")
    print("   This could be due to:")
    print("   - Network maintenance")
    print("   - Endpoint changes")
    print("   - Rate limiting")
    print("   - Testnet instability")

if __name__ == "__main__":
    scrape_with_mock_payment()
    test_real_payment_flow()