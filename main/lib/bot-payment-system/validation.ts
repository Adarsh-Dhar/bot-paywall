/**
 * Validation functions for the Automated Bot Payment System
 */

import { PaymentRecord } from './types';

/**
 * Validates that a payment amount is exactly 0.01 MOVE tokens
 */
export function validatePaymentAmount(amount: number): boolean {
  return amount === 0.01;
}

/**
 * Validates IP address format (IPv4) for Cloudflare API compatibility
 */
export function validateIPAddress(ip: string): boolean {
  // Basic IPv4 format validation
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  
  // Additional Cloudflare-specific validations
  // Ensure no leading zeros in octets (Cloudflare requirement)
  const octets = ip.split('.');
  for (const octet of octets) {
    if (octet.length > 1 && octet.startsWith('0')) {
      return false;
    }
  }
  
  // Ensure it's not a reserved/private IP range for public Cloudflare rules
  // (This is optional - depends on use case)
  const firstOctet = parseInt(octets[0]);
  const secondOctet = parseInt(octets[1]);
  
  // Check for common reserved ranges (optional validation)
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
  if (firstOctet === 10 || 
      firstOctet === 127 || 
      (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
      (firstOctet === 192 && secondOctet === 168)) {
    // For development/testing, we might want to allow these
    // For production, these should typically be rejected
    return process.env.NODE_ENV === 'development' || process.env.ALLOW_PRIVATE_IPS === 'true';
  }
  
  return true;
}

/**
 * Formats IP address for Cloudflare API (ensures proper format)
 */
export function formatIPForCloudflare(ip: string): string {
  if (!validateIPAddress(ip)) {
    throw new Error(`Invalid IP address format: ${ip}`);
  }
  
  // Cloudflare expects standard IPv4 format without leading zeros
  const octets = ip.split('.');
  const formattedOctets = octets.map(octet => parseInt(octet).toString());
  
  return formattedOctets.join('.');
}

/**
 * Validates payment record structure and content
 */
export function validatePaymentRecord(record: PaymentRecord): boolean {
  if (!record.transactionId || typeof record.transactionId !== 'string') {
    return false;
  }
  
  if (!validatePaymentAmount(record.amount)) {
    return false;
  }
  
  if (record.currency !== 'MOVE') {
    return false;
  }
  
  if (!record.payerAddress || typeof record.payerAddress !== 'string') {
    return false;
  }
  
  if (!(record.timestamp instanceof Date)) {
    return false;
  }
  
  return true;
}

/**
 * Validates transaction ID format
 */
export function validateTransactionId(transactionId: string): boolean {
  // Basic validation - transaction ID should be a non-empty string
  // In a real implementation, this would validate against the specific blockchain format
  return typeof transactionId === 'string' && transactionId.length > 0;
}

/**
 * Validates Cloudflare rule ID format
 */
export function validateRuleId(ruleId: string): boolean {
  // Cloudflare rule IDs are typically 32-character hex strings
  const ruleIdRegex = /^[a-f0-9]{32}$/i;
  return ruleIdRegex.test(ruleId);
}