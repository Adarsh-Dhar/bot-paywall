/**
 * Core data models and interfaces for the Automated Bot Payment System
 */

export interface PaymentRecord {
  transactionId: string;
  amount: number;
  currency: 'MOVE';
  timestamp: Date;
  payerAddress: string;
  verified: boolean;
}

export interface BotAllowedEntry {
  id: string;
  ipAddress: string;
  reason: string;
  paymentRecord: PaymentRecord;
  whitelistRuleId?: string;
  createdAt: Date;
  expiresAt?: Date;
  cleanedUp: boolean;
}

export interface AccessRule {
  id: string;
  mode: 'whitelist' | 'block';
  configuration: {
    target: 'ip';
    value: string;
  };
  notes: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  payerAddress?: string;
  error?: string;
}

export interface CleanupResult {
  success: boolean;
  ruleId?: string;
  error?: string;
  retryCount?: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  component: string;
  message: string;
  context?: Record<string, any>;
}