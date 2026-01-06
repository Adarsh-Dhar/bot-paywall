/**
 * Payment Verification Service for x402 MOVE token transactions
 */

import { PaymentVerificationService } from '../interfaces';
import { PaymentResult } from '../types';
import { validatePaymentAmount, validateTransactionId } from '../validation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PaymentVerificationServiceImpl implements PaymentVerificationService {
  private readonly REQUIRED_AMOUNT = 0.01;
  private readonly REQUIRED_CURRENCY = 'MOVE';
  private readonly configuredIP?: string;

  constructor(configuredIP?: string) {
    this.configuredIP = configuredIP;
  }

  /**
   * Verifies an x402 MOVE token transaction
   */
  async verifyTransaction(transactionId: string): Promise<PaymentResult> {
    try {
      // Validate transaction ID format
      if (!validateTransactionId(transactionId)) {
        return {
          success: false,
          error: 'Invalid transaction ID format'
        };
      }

      // Query the MOVE blockchain for transaction data
      const transactionData = await this.fetchTransactionFromBlockchain(transactionId);
      
      if (!transactionData) {
        return {
          success: false,
          error: 'Transaction not found on blockchain'
        };
      }

      // Validate the transaction amount
      if (!this.validateAmount(transactionData.amount)) {
        return {
          success: false,
          error: `Invalid payment amount. Expected ${this.REQUIRED_AMOUNT} ${this.REQUIRED_CURRENCY}, got ${transactionData.amount}`
        };
      }

      // Validate currency
      if (transactionData.currency !== this.REQUIRED_CURRENCY) {
        return {
          success: false,
          error: `Invalid currency. Expected ${this.REQUIRED_CURRENCY}, got ${transactionData.currency}`
        };
      }

      return {
        success: true,
        transactionId,
        amount: transactionData.amount,
        payerAddress: transactionData.payerAddress
      };

    } catch (error) {
      return {
        success: false,
        error: `Transaction verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validates that the payment amount is exactly 0.01 MOVE
   */
  validateAmount(amount: number): boolean {
    return validatePaymentAmount(amount);
  }

  /**
   * Extracts the IP address of the requesting client
   * Uses multiple fallback methods for reliability
   */
  async extractPayerIP(): Promise<string> {
    try {
      // Use configured IP if provided
      if (this.configuredIP) {
        return this.configuredIP;
      }

      // Try multiple IP detection methods in order of reliability
      const ipDetectionMethods = [
        () => this.getIPFromICanHazIP(),
        () => this.getIPFromIPify(),
        () => this.getIPFromHTTPBin(),
        () => this.getIPFromIPInfo(),
        () => this.getIPFromCloudflare(),
        () => this.getLocalNetworkIP()
      ];

      let lastError: Error | null = null;

      for (const method of ipDetectionMethods) {
        try {
          const ip = await method();
          if (ip && this.isValidIPAddress(ip)) {
            return ip;
          }
        } catch (error) {
          lastError = error as Error;
          // Continue to next method
        }
      }

      throw new Error(`All IP detection methods failed. Last error: ${lastError?.message || 'Unknown error'}`);
    } catch (error) {
      throw new Error(`IP extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets IP from icanhazip.com (most reliable)
   */
  private async getIPFromICanHazIP(): Promise<string> {
    const { stdout } = await execAsync('curl -s --connect-timeout 5 icanhazip.com');
    return stdout.trim();
  }

  /**
   * Gets IP from ipify.org
   */
  private async getIPFromIPify(): Promise<string> {
    const { stdout } = await execAsync('curl -s --connect-timeout 5 https://api.ipify.org');
    return stdout.trim();
  }

  /**
   * Gets IP from httpbin.org
   */
  private async getIPFromHTTPBin(): Promise<string> {
    const { stdout } = await execAsync('curl -s --connect-timeout 5 https://httpbin.org/ip');
    const response = JSON.parse(stdout);
    return response.origin;
  }

  /**
   * Gets IP from ipinfo.io
   */
  private async getIPFromIPInfo(): Promise<string> {
    const { stdout } = await execAsync('curl -s --connect-timeout 5 https://ipinfo.io/ip');
    return stdout.trim();
  }

  /**
   * Gets IP from Cloudflare's trace endpoint
   */
  private async getIPFromCloudflare(): Promise<string> {
    const { stdout } = await execAsync('curl -s --connect-timeout 5 https://www.cloudflare.com/cdn-cgi/trace');
    const lines = stdout.split('\n');
    const ipLine = lines.find(line => line.startsWith('ip='));
    if (ipLine) {
      return ipLine.split('=')[1];
    }
    throw new Error('IP not found in Cloudflare trace response');
  }

  /**
   * Gets local network IP as last resort
   */
  private async getLocalNetworkIP(): Promise<string> {
    try {
      // Try to get local IP using hostname command
      const { stdout } = await execAsync('hostname -I | awk \'{print $1}\'');
      const ip = stdout.trim();
      
      // Don't return localhost or private IPs as they won't work for external access
      if (ip && !ip.startsWith('127.') && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
        return ip;
      }
      
      throw new Error('Only private/localhost IP available');
    } catch (error) {
      throw new Error('Local IP detection failed');
    }
  }

  /**
   * Validates IP address format
   */
  private isValidIPAddress(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Selects the most reliable IP source from multiple detected IPs
   */
  async selectMostReliableIP(detectedIPs: string[]): Promise<string> {
    if (detectedIPs.length === 0) {
      throw new Error('No IP addresses detected');
    }

    if (detectedIPs.length === 1) {
      return detectedIPs[0];
    }

    // Preference order for IP sources (most reliable first)
    const sourceReliability = [
      'configured', // Configured IP (highest priority)
      'icanhazip',  // icanhazip.com
      'ipify',      // ipify.org
      'httpbin',    // httpbin.org
      'ipinfo',     // ipinfo.io
      'cloudflare', // Cloudflare trace
      'local'       // Local network IP (lowest priority)
    ];

    // For now, return the first valid IP (most reliable method succeeded)
    // In a more complex implementation, we could cross-reference multiple sources
    return detectedIPs[0];
  }

  /**
   * Fetches transaction data from the MOVE blockchain
   */
  private async fetchTransactionFromBlockchain(transactionId: string): Promise<{
    amount: number;
    currency: string;
    payerAddress: string;
  } | null> {
    // TODO: Implement real blockchain query
    // This should query the MOVE blockchain API to get transaction details
    throw new Error('Real blockchain transaction verification not implemented. Mock transactions have been removed.');
  }

  /**
   * Validates transaction signature
   */
  private validateTransactionSignature(transactionId: string, signature: string): boolean {
    // TODO: Implement real cryptographic signature verification
    throw new Error('Transaction signature validation not implemented. Mock transactions have been removed.');
  }

  /**
   * Checks if a transaction has already been processed to prevent double-spending
   */
  private async isTransactionAlreadyProcessed(transactionId: string): Promise<boolean> {
    // TODO: Implement database check for processed transactions
    throw new Error('Transaction processing check not implemented. Mock transactions have been removed.');
  }
}