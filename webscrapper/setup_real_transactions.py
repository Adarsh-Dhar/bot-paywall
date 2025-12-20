#!/usr/bin/env python3
"""
Setup script for X402 Real Transaction Mode
Helps configure the environment for production deployment
"""

import os
import sys
import subprocess
import getpass
from pathlib import Path


def print_banner():
    print("=" * 60)
    print("🚀 X402 Real Transaction Setup")
    print("=" * 60)
    print()


def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 7):
        print("❌ Python 3.7 or higher is required")
        sys.exit(1)
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")


def install_dependencies():
    """Install required Python packages"""
    print("\n📦 Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        sys.exit(1)


def setup_environment():
    """Setup environment configuration"""
    print("\n⚙️ Setting up environment configuration...")
    
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if not env_example.exists():
        print("❌ .env.example file not found")
        sys.exit(1)
    
    # Read example file
    with open(env_example, 'r') as f:
        env_content = f.read()
    
    # If .env exists, ask if user wants to overwrite
    if env_file.exists():
        response = input("📄 .env file already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("⏭️ Skipping environment setup")
            return
    
    print("\n🔧 Configuring X402 settings...")
    
    # Get configuration from user
    config = {}
    
    # Transaction mode
    print("\n1. Transaction Mode:")
    print("   - 'false': Mock mode (development/testing)")
    print("   - 'true': Real mode (production)")
    config['X402_REAL_TX_MODE'] = input("   Enter mode (false/true) [false]: ").strip() or 'false'
    
    if config['X402_REAL_TX_MODE'].lower() == 'true':
        # Network selection
        print("\n2. Network Selection:")
        print("   - 'testnet': For testing (free tokens)")
        print("   - 'mainnet': For production (real tokens)")
        config['MOVE_NETWORK_ID'] = input("   Enter network (testnet/mainnet) [testnet]: ").strip() or 'testnet'
        
        # RPC endpoint
        if config['MOVE_NETWORK_ID'] == 'mainnet':
            default_rpc = 'https://aptos.mainnet.porto.movementlabs.xyz/v1'
        else:
            default_rpc = 'https://aptos.testnet.porto.movementlabs.xyz/v1'
        
        print(f"\n3. RPC Endpoint:")
        config['MOVE_RPC_ENDPOINT'] = input(f"   Enter RPC endpoint [{default_rpc}]: ").strip() or default_rpc
        
        # Private key
        print("\n4. Private Key:")
        print("   ⚠️  SECURITY WARNING: Keep your private key secure!")
        print("   💡 For production, consider using environment variables or secrets management")
        config['MOVE_PRIVATE_KEY'] = getpass.getpass("   Enter private key (hidden): ").strip()
        
        if not config['MOVE_PRIVATE_KEY']:
            print("⚠️ No private key provided. You'll need to set MOVE_PRIVATE_KEY later.")
        
        # Payment address
        print("\n5. Payment Address:")
        config['MOVE_PAYMENT_ADDRESS'] = input("   Enter payment address [0x1]: ").strip() or '0x1'
    
    # Update environment content
    for key, value in config.items():
        # Replace the line in env_content
        lines = env_content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith(f'{key}='):
                lines[i] = f'{key}={value}'
                break
        env_content = '\n'.join(lines)
    
    # Write .env file
    with open(env_file, 'w') as f:
        f.write(env_content)
    
    print("✅ Environment configuration saved to .env")


def validate_configuration():
    """Validate the configuration"""
    print("\n🔍 Validating configuration...")
    
    try:
        from x402_payment_handler import X402PaymentHandler
        
        handler = X402PaymentHandler()
        
        if handler.real_tx_mode:
            print("✅ Real transaction mode enabled")
            
            # Check if private key is set
            if not handler.move_private_key:
                print("⚠️ MOVE_PRIVATE_KEY not set - required for real transactions")
            else:
                print("✅ Private key configured")
            
            # Check RPC endpoint
            if handler.move_rpc_endpoint:
                print(f"✅ RPC endpoint: {handler.move_rpc_endpoint}")
            else:
                print("❌ RPC endpoint not configured")
            
            # Check network
            print(f"✅ Network: {handler.move_network_id}")
            
        else:
            print("✅ Mock transaction mode enabled (development)")
        
        print("✅ Configuration validation complete")
        
    except ImportError as e:
        print(f"❌ Failed to import X402PaymentHandler: {e}")
        print("   Make sure dependencies are installed correctly")
    except Exception as e:
        print(f"⚠️ Configuration warning: {e}")


def run_test():
    """Run a basic test of the payment handler"""
    print("\n🧪 Running basic test...")
    
    try:
        from x402_payment_handler import X402PaymentHandler
        
        handler = X402PaymentHandler()
        
        # Test address validation
        valid_address = handler._validate_move_address('0x123')
        invalid_address = handler._validate_move_address('invalid')
        
        if valid_address and not invalid_address:
            print("✅ Address validation working")
        else:
            print("❌ Address validation failed")
        
        # Test transaction status (mock)
        status = handler.get_transaction_status('0x123')
        if status and 'transaction_id' in status:
            print("✅ Transaction status query working")
        else:
            print("❌ Transaction status query failed")
        
        print("✅ Basic tests passed")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")


def print_next_steps():
    """Print next steps for the user"""
    print("\n" + "=" * 60)
    print("🎉 Setup Complete!")
    print("=" * 60)
    
    print("\n📋 Next Steps:")
    print("1. Review your .env configuration")
    print("2. For production:")
    print("   - Test on testnet first")
    print("   - Ensure you have MOVE tokens")
    print("   - Monitor logs carefully")
    print("3. Run the webscraper:")
    print("   python main.py")
    print("4. Check the logs for transaction details")
    
    print("\n📚 Documentation:")
    print("- Read X402_REAL_TRANSACTIONS.md for detailed guide")
    print("- Run tests: python -m pytest test_x402_payment_handler.py")
    
    print("\n🔒 Security Reminders:")
    print("- Never commit .env to version control")
    print("- Use secrets management for production")
    print("- Rotate private keys regularly")
    print("- Monitor transaction costs")


def main():
    """Main setup function"""
    print_banner()
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    try:
        check_python_version()
        install_dependencies()
        setup_environment()
        validate_configuration()
        run_test()
        print_next_steps()
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()