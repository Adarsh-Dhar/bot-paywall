#!/usr/bin/env python3
"""
Check wallet balance on Movement testnet
"""
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
import os

load_dotenv()

RPC_URL = "https://mevm.devnet.m1.movementlabs.xyz"
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

if not PRIVATE_KEY:
    print("❌ PRIVATE_KEY not found in .env file")
    exit(1)

# Remove 0x prefix if present
if PRIVATE_KEY.startswith("0x"):
    PRIVATE_KEY = PRIVATE_KEY[2:]

try:
    # Connect to RPC
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    
    # Test connection
    chain_id = w3.eth.chain_id
    print(f"✅ Connected to Movement testnet (Chain ID: {chain_id})")
    
    # Get account from private key
    account = Account.from_key(PRIVATE_KEY)
    address = account.address
    print(f"📍 Wallet address: {address}")
    
    # Check balance
    balance_wei = w3.eth.get_balance(address)
    balance_move = w3.from_wei(balance_wei, 'ether')
    
    print(f"💰 Balance: {balance_move} MOVE")
    
    if balance_move == 0:
        print("\n⚠️ Wallet has no funds!")
        print("To get testnet MOVE tokens:")
        print("1. Visit a Movement testnet faucet")
        print("2. Request tokens for address:", address)
        print("3. Wait for the transaction to confirm")
    elif balance_move < 0.02:  # Need at least 0.01 for payment + gas
        print(f"\n⚠️ Low balance! You have {balance_move} MOVE")
        print("You need at least 0.02 MOVE (0.01 for payment + gas)")
    else:
        print(f"\n✅ Sufficient balance for payment!")
        
        # Get current gas price
        gas_price = w3.eth.gas_price
        gas_cost_wei = 100000 * gas_price  # Estimate 100k gas
        gas_cost_move = w3.from_wei(gas_cost_wei, 'ether')
        
        print(f"⛽ Estimated gas cost: {gas_cost_move} MOVE")
        print(f"💸 Payment amount: 0.01 MOVE")
        print(f"📊 Total needed: {0.01 + float(gas_cost_move)} MOVE")

except Exception as e:
    print(f"❌ Error: {e}")