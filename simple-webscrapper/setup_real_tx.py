#!/usr/bin/env python3
"""
Setup script for real MOVE blockchain transactions
"""

import os
import sys
import subprocess
from pathlib import Path

def print_banner():
    print("=" * 60)
    print("🚀 Real MOVE Transaction Setup")
    print("=" * 60)
    print()

def install_dependencies():
    """Install required dependencies"""
    print("📦 Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False
    return True

def setup_environment():
    """Setup environment configuration"""
    print("\n⚙️ Setting up environment...")
    
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if env_file.exists():
        response = input("📄 .env file already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("⏭️ Using existing .env file")
            return True
    
    # Copy example to .env
    if env_example.exists():
        with open(env_example, 'r') as f:
            content = f.read()
        
        with open(env_file, 'w') as f:
            f.write(content)
        
        print("✅ Created .env file from template")
    else:
        print("❌ .env.example not found")
        return False
    
    return True

def get_wallet_setup_instructions():
    """Provide wallet setup instructions"""
    print("\n" + "=" * 60)
    print("💰 WALLET SETUP REQUIRED")
    print("=" * 60)
    
    print("\nTo use real transactions, you need:")
    print("1. A Movement/Aptos wallet with MOVE tokens")
    print("2. Your wallet's private key")
    print("3. Testnet MOVE tokens for testing")
    
    print("\n📋 Steps to get started:")
    print("1. Install Aptos CLI:")
    print("   curl -fsSL https://aptos.dev/scripts/install_cli.py | python3")
    
    print("\n2. Create a new wallet:")
    print("   aptos init --network testnet")
    
    print("\n3. Fund your wallet with testnet tokens:")
    print("   aptos account fund-with-faucet --account <your-address>")
    
    print("\n4. Get your private key:")
    print("   aptos config show-private-key --profile default")
    
    print("\n5. Update your .env file:")
    print("   REAL_TX_MODE=true")
    print("   MOVE_PRIVATE_KEY=<your-64-character-private-key>")
    
    print("\n⚠️  SECURITY WARNING:")
    print("- Never commit your private key to version control")
    print("- Use testnet for development")
    print("- Keep your private key secure")

def test_configuration():
    """Test the current configuration"""
    print("\n🧪 Testing configuration...")
    
    try:
        from real_payment_handler import RealPaymentHandler
        
        handler = RealPaymentHandler()
        
        print(f"✅ Real TX Mode: {handler.real_tx_mode}")
        print(f"✅ Network: {handler.network_id}")
        print(f"✅ RPC Endpoint: {handler.rpc_endpoint}")
        
        if handler.real_tx_mode:
            if handler.account:
                print(f"✅ Account Address: {handler.account.address()}")
                balance = handler.get_account_balance()
                print(f"✅ Balance: {balance / 100_000_000:.8f} MOVE")
                
                if balance == 0:
                    print("⚠️  Warning: Account balance is 0. Fund your account with testnet tokens.")
                elif balance < 1_000_000:  # Less than 0.01 MOVE
                    print("⚠️  Warning: Low balance. Consider funding your account.")
            else:
                print("❌ Account not initialized. Check your private key.")
        else:
            print("ℹ️  Mock mode enabled. Set REAL_TX_MODE=true for real transactions.")
        
        print("✅ Configuration test completed")
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

def main():
    print_banner()
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    try:
        # Install dependencies
        if not install_dependencies():
            return 1
        
        # Setup environment
        if not setup_environment():
            return 1
        
        # Test configuration
        test_configuration()
        
        # Show wallet setup instructions
        get_wallet_setup_instructions()
        
        print("\n" + "=" * 60)
        print("🎉 Setup Complete!")
        print("=" * 60)
        
        print("\n📋 Next Steps:")
        print("1. Follow the wallet setup instructions above")
        print("2. Update your .env file with your private key")
        print("3. Set REAL_TX_MODE=true in .env")
        print("4. Run: python scraper.py")
        
        print("\n🔧 Testing:")
        print("- Mock mode: python scraper.py (REAL_TX_MODE=false)")
        print("- Real mode: python scraper.py (REAL_TX_MODE=true)")
        print("- Test handler: python real_payment_handler.py")
        
        return 0
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Setup cancelled by user")
        return 1
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())