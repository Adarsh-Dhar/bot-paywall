/**
 * Service interfaces for the Automated Bot Payment System
 */

import { PaymentRecord, BotAllowedEntry, AccessRule, PaymentResult, CleanupResult, LogEntry } from './types';

export interface PaymentVerificationService {
  verifyTransaction(transactionId: string): Promise<PaymentResult>;
  validateAmount(amount: number): boolean;
  extractPayerIP(): Promise<string>;
}

export interface IPManagementService {
  addBotIP(ip: string, paymentDetails: PaymentRecord): Promise<void>;
  createWhitelistRule(ip: string): Promise<string>;
  removeWhitelistRule(ruleId: string): Promise<void>;
  scheduleCleanup(ip: string, delay: number): Promise<void>;
}

export interface CloudflareClient {
  createAccessRule(ip: string, mode: 'whitelist'): Promise<AccessRule>;
  deleteAccessRule(ruleId: string): Promise<void>;
  listAccessRules(ip?: string): Promise<AccessRule[]>;
}

export interface DatabaseService {
  addBotEntry(entry: BotAllowedEntry): Promise<void>;
  updateBotEntry(id: string, updates: Partial<BotAllowedEntry>): Promise<void>;
  getBotEntry(ip: string): Promise<BotAllowedEntry | null>;
}

export interface CleanupScheduler {
  scheduleCleanup(ip: string, delay: number): Promise<void>;
  cancelCleanup(ip: string): Promise<void>;
  executeCleanup(ip: string): Promise<CleanupResult>;
}

export interface LoggingService {
  log(entry: LogEntry): Promise<void>;
  logPaymentVerification(transactionId: string, ip: string, success: boolean): Promise<void>;
  logCloudflareOperation(operation: string, ip: string, success: boolean, error?: string): Promise<void>;
  logDatabaseOperation(operation: string, ip: string, success: boolean, error?: string): Promise<void>;
  logError(component: string, error: Error, context?: Record<string, unknown>): Promise<void>;
}

export interface BotExecutionMonitor {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  onBotExecution(callback: (ip: string) => Promise<void>): void;
}