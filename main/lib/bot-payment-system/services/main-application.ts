/**
 * Main Application Service - Orchestrates all bot payment system services
 */

import { PaymentVerificationServiceImpl } from './payment-verification';
import { DatabaseServiceImpl } from './database';
import { LoggingServiceImpl } from './logging';
import { BotExecutionMonitorImpl } from './bot-execution-monitor';
import { PrismaClient } from '@prisma/client';
import {
  PaymentVerificationService,
  DatabaseService,
  LoggingService,
  BotExecutionMonitor
} from '../interfaces';
import { PaymentResult, BotAllowedEntry, PaymentRecord } from '../types';
import { validatePaymentAmount, validateIPAddress } from '../validation';

export interface BotPaymentSystemConfig {
  // Database configuration
  prismaClient?: PrismaClient;
  
  // Monitoring configuration
  webscrapperPath?: string;
  logFilePath?: string;
  monitoringCheckInterval?: number;
  
  // Logging configuration
  enableConsoleLogging?: boolean;
  enableFileLogging?: boolean;
  
  // System configuration
  cleanupDelayMs?: number;
  maxRetryAttempts?: number;
  retryBaseDelayMs?: number;
  
  // IP configuration
  configuredClientIP?: string;
}

export class BotPaymentSystemApplication {
  private paymentVerificationService!: PaymentVerificationService;
  private databaseService!: DatabaseService;
  private loggingService!: LoggingService;
  private botExecutionMonitor!: BotExecutionMonitor;
  
  private isRunning = false;
  private readonly config: Required<BotPaymentSystemConfig>;

  constructor(config: BotPaymentSystemConfig = {}) {
    // Set default configuration
    this.config = {
      prismaClient: config.prismaClient || new PrismaClient(),
      webscrapperPath: config.webscrapperPath || process.cwd() + '/webscrapper',
      logFilePath: config.logFilePath || process.env.LOG_FILE_PATH || process.cwd() + '/webscrapper/webscrapper.log',
      monitoringCheckInterval: config.monitoringCheckInterval || 5000,
      enableConsoleLogging: config.enableConsoleLogging ?? true,
      enableFileLogging: config.enableFileLogging ?? false,
      cleanupDelayMs: config.cleanupDelayMs || 60000, // 60 seconds
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryBaseDelayMs: config.retryBaseDelayMs || 1000,
      // Do not hardcode a fallback IP; rely on explicit config/env or dynamic detection downstream
      configuredClientIP: config.configuredClientIP || process.env.CONFIGURED_CLIENT_IP
    };

    // Initialize services
    this.initializeServices();
  }

  /**
   * Starts the bot payment system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'warn',
        component: 'BotPaymentSystem',
        message: 'System is already running'
      });
      return;
    }

    try {
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Starting bot payment system...',
        context: {
          config: {
            cleanupDelayMs: this.config.cleanupDelayMs,
            monitoringCheckInterval: this.config.monitoringCheckInterval,
            webscrapperPath: this.config.webscrapperPath
          }
        }
      });

      // Validate configuration
      await this.validateConfiguration();

      // Set up bot execution monitoring
      this.botExecutionMonitor.onBotExecution(async (ip: string) => {
        await this.handleBotExecution(ip);
      });

      // Start monitoring for bot execution
      await this.botExecutionMonitor.startMonitoring();

      this.isRunning = true;

      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Bot payment system started successfully'
      });

    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'start_system'
      });
      throw error;
    }
  }

  /**
   * Stops the bot payment system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Stopping bot payment system...'
      });

      // Stop bot execution monitoring
      await this.botExecutionMonitor.stopMonitoring();

      // Cancel all scheduled cleanups
      // Note: Individual cleanups are cancelled when entries are removed

      // Disconnect from database
      if (this.databaseService instanceof DatabaseServiceImpl) {
        await this.databaseService.disconnect();
      }

      this.isRunning = false;

      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Bot payment system stopped successfully'
      });

    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'stop_system'
      });
      throw error;
    }
  }

  /**
   * Handles bot execution by processing payment and managing access
   */
  private async handleBotExecution(ip: string): Promise<void> {
    try {
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Processing bot execution',
        context: { ip }
      });

      // Check if IP already has active access
      const existingEntry = await this.databaseService.getBotEntry(ip);
      if (existingEntry && !existingEntry.cleanedUp) {
        await this.loggingService.log({
          timestamp: new Date(),
          level: 'info',
          component: 'BotPaymentSystem',
          message: 'IP already has active access',
          context: { ip, entryId: existingEntry.id }
        });
        return;
      }

      // Real implementation required - no mock transactions
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'error',
        component: 'BotPaymentSystem',
        message: 'Real x402 payment integration required. Mock transactions have been removed.',
        context: { ip }
      });

    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'handle_bot_execution',
        ip
      });
    }
  }

  /**
   * Manually processes a payment transaction (for testing or manual triggers)
   */
  async processPayment(transactionId: string, projectId: string, ip?: string): Promise<{
    success: boolean;
    entryId?: string;
    ruleId?: string;
    error?: string;
  }> {
    try {
      if (!projectId) {
        return {
          success: false,
          error: 'Project ID is required'
        };
      }

      // Import factory function dynamically to avoid circular dependencies
      const { getCloudflareClientForProject } = await import('@/lib/cloudflare-client-factory');
      const { CleanupSchedulerImpl } = await import('./cleanup-scheduler');

      // Get Cloudflare client for this project
      const cloudflareClient = await getCloudflareClientForProject(projectId);

      // Detect IP if not provided
      const targetIP = ip || await this.paymentVerificationService.extractPayerIP();

      // Validate IP format
      if (!validateIPAddress(targetIP)) {
        return {
          success: false,
          error: 'Invalid IP address format'
        };
      }

      // Verify payment
      const paymentResult = await this.paymentVerificationService.verifyTransaction(transactionId);
      
      if (!paymentResult.success) {
        return {
          success: false,
          error: paymentResult.error
        };
      }

      // Create payment record
      const paymentRecord: PaymentRecord = {
        transactionId,
        amount: paymentResult.amount || 0.01,
        currency: 'MOVE',
        timestamp: new Date(),
        payerAddress: paymentResult.payerAddress || 'unknown',
        verified: true
      };

      // Add to database
      const entryId = await (this.databaseService as DatabaseServiceImpl).addBotEntryWithPayment(
        targetIP,
        paymentRecord
      );

      // Create Cloudflare rule
      const accessRule = await cloudflareClient.createAccessRule(targetIP, 'whitelist');

      // Create cleanup scheduler for this operation
      const cleanupScheduler = new CleanupSchedulerImpl(
        cloudflareClient,
        this.databaseService,
        this.loggingService
      );

      // Schedule cleanup
      await cleanupScheduler.scheduleCleanup(targetIP, this.config.cleanupDelayMs);

      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Manual payment processed successfully',
        context: {
          transactionId,
          projectId,
          ip: targetIP,
          entryId,
          ruleId: accessRule.id
        }
      });

      return {
        success: true,
        entryId,
        ruleId: accessRule.id
      };

    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'process_payment',
        transactionId,
        projectId,
        ip
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets system status and statistics
   */
  async getSystemStatus(): Promise<{
    isRunning: boolean;
    monitoringStats: any;
    cleanupStats: any;
    logStats: any;
    databaseConnected: boolean;
  }> {
    try {
      // Test database connection
      let databaseConnected = false;
      try {
        await this.databaseService.getBotEntry('test-connection-check');
        databaseConnected = true;
      } catch (error) {
        databaseConnected = false;
      }

      return {
        isRunning: this.isRunning,
        monitoringStats: { isMonitoring: false }, // Stats not available in interface
        cleanupStats: { scheduledCleanups: 0 }, // Stats not available in interface
        logStats: (this.loggingService as LoggingServiceImpl).getLogStats(),
        databaseConnected
      };

    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'get_system_status'
      });
      throw error;
    }
  }

  /**
   * Gets recent system logs
   */
  getRecentLogs(count?: number): any[] {
    return (this.loggingService as LoggingServiceImpl).getRecentLogs(count);
  }

  /**
   * Exports system logs
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const loggingImpl = this.loggingService as LoggingServiceImpl;
    return format === 'json' ? loggingImpl.exportLogsAsJSON() : loggingImpl.exportLogsAsCSV();
  }

  /**
   * Forces immediate cleanup of expired entries
   */
  async forceCleanup(): Promise<void> {
    try {
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Forcing immediate cleanup of expired entries'
      });

      // Remove expired database entries (older than cleanup delay)
      const expiryTime = new Date(Date.now() - this.config.cleanupDelayMs);
      const removedCount = await (this.databaseService as DatabaseServiceImpl).removeExpiredEntries(expiryTime);

      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Force cleanup completed',
        context: { removedCount }
      });

    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'force_cleanup'
      });
      throw error;
    }
  }

  /**
   * Validates system configuration
   */
  private async validateConfiguration(): Promise<void> {
    // Cloudflare credentials are now fetched from database per operation
    // No global validation needed here

    await this.loggingService.log({
      timestamp: new Date(),
      level: 'info',
      component: 'BotPaymentSystem',
      message: 'Configuration validation passed'
    });
  }

  /**
   * Initializes all services with proper dependencies
   */
  private initializeServices(): void {
    // Initialize logging service first (other services depend on it)
    this.loggingService = new LoggingServiceImpl({
      logToConsole: this.config.enableConsoleLogging,
      logToFile: this.config.enableFileLogging,
      logFilePath: this.config.logFilePath
    });

    // Initialize core services
    this.paymentVerificationService = new PaymentVerificationServiceImpl(this.config.configuredClientIP);
    this.databaseService = new DatabaseServiceImpl(this.config.prismaClient);
    
    // CloudflareClient is now created per operation using factory (project-specific)
    // CleanupScheduler is now created per operation when needed (project-specific)

    // Initialize bot execution monitor
    this.botExecutionMonitor = new BotExecutionMonitorImpl(
      this.loggingService,
      {
        webscrapperPath: this.config.webscrapperPath,
        logFilePath: this.config.logFilePath,
        checkInterval: this.config.monitoringCheckInterval
      }
    );
  }

  /**
   * Gets the current configuration
   */
  getConfiguration(): Readonly<BotPaymentSystemConfig> {
    return { ...this.config };
  }

  /**
   * Checks if the system is currently running
   */
  isSystemRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Graceful shutdown with cleanup
   */
  async gracefulShutdown(): Promise<void> {
    await this.loggingService.log({
      timestamp: new Date(),
      level: 'info',
      component: 'BotPaymentSystem',
      message: 'Initiating graceful shutdown...'
    });

    try {
      await this.stop();
      
      await this.loggingService.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotPaymentSystem',
        message: 'Graceful shutdown completed'
      });
    } catch (error) {
      await this.loggingService.logError('BotPaymentSystem', error as Error, {
        operation: 'graceful_shutdown'
      });
      throw error;
    }
  }
}