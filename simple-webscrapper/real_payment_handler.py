"""
Real MOVE blockchain payment handler for x402 payments
Real transactions only - no simulation mode
"""

import os
import time
import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

try:
    from aptos_sdk.account import Account
    from aptos_sdk.async_client import RestClient
    from aptos_sdk.transactions import (
        EntryFunction,
        TransactionPayload,
    )
    from aptos_sdk.type_tag import TypeTag, StructTag
    APTOS_SDK_AVAILABLE = True
except ImportError as e:
    APTOS_SDK_AVAILABLE = False
    logger.error(f"Aptos SDK import error: {e}")
    logger.error("Install with: pip install aptos-sdk")
    raise ImportError(f"Aptos SDK is required for real transactions. Error: {e}")


class RealPaymentHandler:
    """Handles real MOVE blockchain payments only"""
    
    def __init__(self):
        self.network_id = os.getenv('MOVE_NETWORK_ID', 'testnet')
        self.rpc_endpoint = os.getenv('MOVE_RPC_ENDPOINT')
        self.private_key = os.getenv('MOVE_PRIVATE_KEY')
        
        # Validate required configuration
        if not self.rpc_endpoint:
            raise ValueError("MOVE_RPC_ENDPOINT environment variable is required")
        if not self.private_key:
            raise ValueError("MOVE_PRIVATE_KEY environment variable is required")
        
        # Initialize account (client will be created per operation)
        self.account = Account.load_key(self.private_key)
        logger.info(f"Initialized real transaction mode on {self.network_id}")
        logger.info(f"Account address: {self.account.address()}")
    
    def _run_async(self, coro):
        """Helper to run async operations safely"""
        try:
            # Try to get existing event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is running, we need to create a new one in a thread
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, coro)
                    return future.result()
            else:
                return loop.run_until_complete(coro)
        except RuntimeError:
            # No event loop exists, create a new one
            return asyncio.run(coro)
    
    def get_account_balance(self) -> int:
        """Get the current MOVE token balance"""
        try:
            return self._run_async(self._get_account_balance_async())
        except Exception as e:
            logger.error(f"Failed to get account balance: {e}")
            return 0
    
    async def _get_account_balance_async(self) -> int:
        """Async version of get_account_balance"""
        client = RestClient(self.rpc_endpoint)
        try:
            resources = await client.account_resources(self.account.address())
            for resource in resources:
                if resource["type"] == "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>":
                    return int(resource["data"]["coin"]["value"])
            return 0
        except Exception as e:
            logger.error(f"Failed to get account balance: {e}")
            return 0
        finally:
            await client.close()
    
    def make_move_payment(self, to_address: str, amount_move: float) -> Optional[str]:
        """
        Make a real MOVE token payment
        
        Args:
            to_address: Recipient address
            amount_move: Amount in MOVE tokens (e.g., 0.01)
            
        Returns:
            Transaction hash if successful, None if failed
        """
        try:
            return self._run_async(self._make_move_payment_async(to_address, amount_move))
        except Exception as e:
            logger.error(f"❌ Payment failed: {e}")
            return None
    
    async def _make_move_payment_async(self, to_address: str, amount_move: float) -> Optional[str]:
        """Async version of make_move_payment"""
        # Convert MOVE to octas (1 MOVE = 100,000,000 octas)
        amount_octas = int(amount_move * 100_000_000)
        
        logger.info(f"💰 Making payment: {amount_move} MOVE ({amount_octas} octas) to {to_address}")
        
        client = RestClient(self.rpc_endpoint)
        try:
            # Check balance
            balance = await self._get_account_balance_async()
            if balance < amount_octas:
                logger.error(f"Insufficient balance: {balance} octas < {amount_octas} octas")
                return None
            
            logger.info(f"Current balance: {balance / 100_000_000:.8f} MOVE")
            
            # Create AccountAddress object for the recipient
            from aptos_sdk.account_address import AccountAddress
            recipient_address = AccountAddress.from_str(to_address)
            
            # Use the bcs_transfer method
            logger.info("📡 Submitting transaction to blockchain...")
            tx_hash = await client.bcs_transfer(self.account, recipient_address, amount_octas)
            logger.info(f"📋 Transaction submitted: {tx_hash}")
            
            # Wait for confirmation
            logger.info("⏳ Waiting for transaction confirmation...")
            await client.wait_for_transaction(tx_hash)
            
            # Verify transaction
            tx_info = await client.transaction_by_hash(tx_hash)
            if tx_info.get("success"):
                logger.info("✅ Transaction confirmed successfully!")
                logger.info(f"📋 Final transaction hash: {tx_hash}")
                return tx_hash
            else:
                logger.error(f"❌ Transaction failed: {tx_info}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Payment failed: {e}")
            return None
        finally:
            await client.close()
    
    def verify_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """
        Verify a transaction on the blockchain
        
        Returns:
            Dictionary with verification details
        """
        try:
            return self._run_async(self._verify_transaction_async(tx_hash))
        except Exception as e:
            logger.error(f"Failed to verify transaction {tx_hash}: {e}")
            return {
                "verified": False,
                "status": "error",
                "error": str(e),
                "transaction_hash": tx_hash
            }
    
    async def _verify_transaction_async(self, tx_hash: str) -> Dict[str, Any]:
        """Async version of verify_transaction"""
        client = RestClient(self.rpc_endpoint)
        try:
            tx_info = await client.transaction_by_hash(tx_hash)
            
            return {
                "verified": tx_info.get("success", False),
                "status": "confirmed" if tx_info.get("success") else "failed",
                "transaction_hash": tx_hash,
                "gas_used": tx_info.get("gas_used"),
                "timestamp": tx_info.get("timestamp"),
                "version": tx_info.get("version")
            }
            
        except Exception as e:
            logger.error(f"Failed to verify transaction {tx_hash}: {e}")
            return {
                "verified": False,
                "status": "error",
                "error": str(e),
                "transaction_hash": tx_hash
            }
        finally:
            await client.close()
    
    def get_transaction_status(self, tx_hash: str) -> str:
        """Get simple transaction status"""
        verification = self.verify_transaction(tx_hash)
        return verification.get("status", "unknown")


def test_payment_handler():
    """Test the payment handler"""
    handler = RealPaymentHandler()
    
    print(f"Network: {handler.network_id}")
    print(f"RPC Endpoint: {handler.rpc_endpoint}")
    print(f"Account Address: {handler.account.address()}")
    
    balance = handler.get_account_balance()
    print(f"Balance: {balance / 100_000_000:.8f} MOVE")
    
    # Test payment
    test_address = "0x1234567890abcdef1234567890abcdef12345678"
    tx_hash = handler.make_move_payment(test_address, 0.01)
    
    if tx_hash:
        print(f"Payment successful: {tx_hash}")
        
        # Verify transaction
        verification = handler.verify_transaction(tx_hash)
        print(f"Verification: {verification}")
    else:
        print("Payment failed")


if __name__ == "__main__":
    test_payment_handler()