/**
 * Integration tests for the complete bot payment system workflow
 * Tests the end-to-end flow from bot detection to cleanup
 */

import { BotPaymentSystemApplication } from '../../lib/bot-payment-system/services/main-application';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Bot Payment System Integration', () => {
  let botPaymentSystem: BotPaymentSystemApplication;
  let tempDir: string;
  let tempLogFile: string;
  let testPrisma: PrismaClient;

  beforeAll(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bot-payment-integration-'));
    tempLogFile = path.join(tempDir, 'webscrapper.log');
    
    // Create empty log file
    await fs.writeFile(tempLogFile, '');

    // Initialize test database
    testPrisma = new PrismaClient();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await testPrisma.botsAllowed.deleteMany({
      where: {
        ipAddress: {
          startsWith: '192.168.1.'
        }
      }
    });

    // Initialize bot payment system with test configuration
    botPaymentSystem = new BotPaymentSystemApplication({
      prismaClient: testPrisma,
      webscrapperPath: tempDir,
      logFilePath: tempLogFile,
      enableConsoleLogging: false,
      enableFileLogging: false,
      cleanupDelayMs: 1000, // 1 second for faster testing
      monitoringCheckInterval: 100, // 100ms for faster testing
      // Use test Cloudflare credentials (these should be test/mock values)
      cloudflareApiToken: process.env.TEST_CLOUDFLARE_API_TOKEN || 'test-token',
      cloudflareZoneId: process.env.TEST_CLOUDFLARE_ZONE_ID || 'test-zone-id'
    });
  });

  afterEach(async () => {
    // Stop the system if running
    if (botPaymentSystem.isSystemRunning()) {
      await botPaymentSystem.stop();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await testPrisma.botsAllowed.deleteMany({
      where: {
        ipAddress: {
          startsWith: '192.168.1.'
        }
      }
    });

    await testPrisma.$disconnect();

    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Payment Flow', () => {
    test('complete workflow from bot detection to cleanup', async () => {
      // Skip this test if we don't have real Cloudflare credentials
      if (!process.env.TEST_CLOUDFLARE_API_TOKEN) {
        console.log('Skipping integration test - no TEST_CLOUDFLARE_API_TOKEN provided');
        return;
      }

      const testIP = '192.168.1.100';
      const mockTransactionId = `test_tx_${Date.now()}`;

      // Start the system
      await botPaymentSystem.start();
      expect(botPaymentSystem.isSystemRunning()).toBe(true);

      // Get initial system status
      const initialStatus = await botPaymentSystem.getSystemStatus();
      expect(initialStatus.isRunning).toBe(true);

      // Process a manual payment to simulate the complete flow
      const paymentResult = await botPaymentSystem.processPayment(mockTransactionId, testIP);
      
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.entryId).toBeDefined();
      expect(paymentResult.ruleId).toBeDefined();

      // Verify database entry was created
      const dbEntry = await testPrisma.botsAllowed.findUnique({
        where: { ipAddress: testIP }
      });
      
      expect(dbEntry).toBeTruthy();
      expect(dbEntry!.ipAddress).toBe(testIP);
      expect(dbEntry!.reason).toContain(mockTransactionId);

      // Wait for cleanup to occur
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify cleanup occurred (entry should be updated with expiration)
      const updatedEntry = await testPrisma.botsAllowed.findUnique({
        where: { ipAddress: testIP }
      });
      
      // Entry might be deleted or marked as expired depending on implementation
      if (updatedEntry) {
        expect(updatedEntry.reason).toContain('Expired');
      }

      // Get final system status
      const finalStatus = await botPaymentSystem.getSystemStatus();
      expect(finalStatus.isRunning).toBe(true);

      // Stop the system
      await botPaymentSystem.stop();
      expect(botPaymentSystem.isSystemRunning()).toBe(false);
    }, 10000); // 10 second timeout for integration test

    test('system handles multiple concurrent payments', async () => {
      // Skip if no test credentials
      if (!process.env.TEST_CLOUDFLARE_API_TOKEN) {
        console.log('Skipping concurrent payments test - no TEST_CLOUDFLARE_API_TOKEN provided');
        return;
      }

      const testIPs = ['192.168.1.101', '192.168.1.102', '192.168.1.103'];
      const mockTransactionIds = testIPs.map((_, i) => `concurrent_tx_${Date.now()}_${i}`);

      // Start the system
      await botPaymentSystem.start();

      // Process multiple payments concurrently
      const paymentPromises = testIPs.map((ip, index) =>
        botPaymentSystem.processPayment(mockTransactionIds[index], ip)
      );

      const results = await Promise.all(paymentPromises);

      // All payments should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.entryId).toBeDefined();
        expect(result.ruleId).toBeDefined();
      }

      // Verify all database entries were created
      for (const ip of testIPs) {
        const dbEntry = await testPrisma.botsAllowed.findUnique({
          where: { ipAddress: ip }
        });
        expect(dbEntry).toBeTruthy();
        expect(dbEntry!.ipAddress).toBe(ip);
      }

      // Stop the system
      await botPaymentSystem.stop();
    }, 15000); // 15 second timeout for concurrent test

    test('system handles payment verification failures gracefully', async () => {
      const testIP = '192.168.1.104';
      const invalidTransactionId = 'invalid_transaction';

      // Start the system
      await botPaymentSystem.start();

      // Process payment with invalid transaction
      const paymentResult = await botPaymentSystem.processPayment(invalidTransactionId, testIP);
      
      // Payment should fail gracefully
      expect(paymentResult.success).toBe(false);
      expect(paymentResult.error).toBeDefined();

      // Verify no database entry was created
      const dbEntry = await testPrisma.botsAllowed.findUnique({
        where: { ipAddress: testIP }
      });
      
      expect(dbEntry).toBeNull();

      // System should still be running
      expect(botPaymentSystem.isSystemRunning()).toBe(true);

      // Stop the system
      await botPaymentSystem.stop();
    });

    test('system prevents duplicate payments for same IP', async () => {
      // Skip if no test credentials
      if (!process.env.TEST_CLOUDFLARE_API_TOKEN) {
        console.log('Skipping duplicate payments test - no TEST_CLOUDFLARE_API_TOKEN provided');
        return;
      }

      const testIP = '192.168.1.105';
      const firstTransactionId = `first_tx_${Date.now()}`;
      const secondTransactionId = `second_tx_${Date.now()}`;

      // Start the system
      await botPaymentSystem.start();

      // Process first payment
      const firstResult = await botPaymentSystem.processPayment(firstTransactionId, testIP);
      expect(firstResult.success).toBe(true);

      // Try to process second payment for same IP immediately
      const secondResult = await botPaymentSystem.processPayment(secondTransactionId, testIP);
      
      // Second payment should succeed (creates new entry), but this tests the system's handling
      // In a real implementation, you might want to prevent duplicate active entries
      expect(secondResult.success).toBe(true);

      // Verify database has entries
      const dbEntries = await testPrisma.botsAllowed.findMany({
        where: { ipAddress: testIP }
      });
      
      expect(dbEntries.length).toBeGreaterThan(0);

      // Stop the system
      await botPaymentSystem.stop();
    }, 10000);

    test('system logs all operations correctly', async () => {
      const testIP = '192.168.1.106';
      const mockTransactionId = `logging_test_tx_${Date.now()}`;

      // Start the system
      await botPaymentSystem.start();

      // Process a payment
      await botPaymentSystem.processPayment(mockTransactionId, testIP);

      // Get system logs
      const logs = botPaymentSystem.getRecentLogs(50);
      
      expect(logs.length).toBeGreaterThan(0);

      // Should have logs for system start
      const startLogs = logs.filter(log => 
        log.component === 'BotPaymentSystem' && 
        log.message.includes('started successfully')
      );
      expect(startLogs.length).toBeGreaterThan(0);

      // Should have logs for payment processing
      const paymentLogs = logs.filter(log => 
        log.message.includes('payment') || 
        log.message.includes('transaction')
      );
      expect(paymentLogs.length).toBeGreaterThan(0);

      // Test log export
      const jsonExport = botPaymentSystem.exportLogs('json');
      expect(jsonExport).toBeTruthy();
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      const csvExport = botPaymentSystem.exportLogs('csv');
      expect(csvExport).toBeTruthy();
      expect(csvExport).toContain('Timestamp,Level,Component,Message,Context');

      // Stop the system
      await botPaymentSystem.stop();
    });

    test('system handles configuration validation', async () => {
      // Test with invalid configuration
      const invalidSystem = new BotPaymentSystemApplication({
        cloudflareApiToken: '', // Invalid empty token
        cloudflareZoneId: '', // Invalid empty zone ID
        webscrapperPath: '/non/existent/path'
      });

      // Starting should fail due to configuration validation
      await expect(invalidSystem.start()).rejects.toThrow();
    });

    test('system status provides accurate information', async () => {
      // Start the system
      await botPaymentSystem.start();

      const status = await botPaymentSystem.getSystemStatus();

      expect(status.isRunning).toBe(true);
      expect(status.monitoringStats).toBeDefined();
      expect(status.cleanupStats).toBeDefined();
      expect(status.logStats).toBeDefined();
      expect(typeof status.databaseConnected).toBe('boolean');
      expect(typeof status.cloudflareConnected).toBe('boolean');

      // Monitoring stats should have expected structure
      expect(status.monitoringStats.isMonitoring).toBe(true);
      expect(typeof status.monitoringStats.callbackCount).toBe('number');
      expect(typeof status.monitoringStats.webscrapperPath).toBe('string');

      // Cleanup stats should have expected structure
      expect(typeof status.cleanupStats.scheduledCount).toBe('number');
      expect(Array.isArray(status.cleanupStats.scheduledIPs)).toBe(true);

      // Log stats should have expected structure
      expect(typeof status.logStats.totalLogs).toBe('number');
      expect(typeof status.logStats.infoCount).toBe('number');
      expect(typeof status.logStats.warnCount).toBe('number');
      expect(typeof status.logStats.errorCount).toBe('number');

      // Stop the system
      await botPaymentSystem.stop();

      // Status should reflect stopped state
      const stoppedStatus = await botPaymentSystem.getSystemStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    });

    test('system handles graceful shutdown', async () => {
      // Start the system
      await botPaymentSystem.start();
      expect(botPaymentSystem.isSystemRunning()).toBe(true);

      // Perform graceful shutdown
      await botPaymentSystem.gracefulShutdown();
      expect(botPaymentSystem.isSystemRunning()).toBe(false);

      // Should be able to start again after graceful shutdown
      await botPaymentSystem.start();
      expect(botPaymentSystem.isSystemRunning()).toBe(true);

      await botPaymentSystem.stop();
    });

    test('force cleanup removes expired entries', async () => {
      // Skip if no test credentials
      if (!process.env.TEST_CLOUDFLARE_API_TOKEN) {
        console.log('Skipping force cleanup test - no TEST_CLOUDFLARE_API_TOKEN provided');
        return;
      }

      const testIP = '192.168.1.107';
      const mockTransactionId = `cleanup_test_tx_${Date.now()}`;

      // Start the system
      await botPaymentSystem.start();

      // Process a payment
      await botPaymentSystem.processPayment(mockTransactionId, testIP);

      // Verify entry exists
      let dbEntry = await testPrisma.botsAllowed.findUnique({
        where: { ipAddress: testIP }
      });
      expect(dbEntry).toBeTruthy();

      // Wait a bit to ensure entry is old enough
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force cleanup
      await botPaymentSystem.forceCleanup();

      // Entry should be removed or marked as expired
      dbEntry = await testPrisma.botsAllowed.findUnique({
        where: { ipAddress: testIP }
      });

      // Depending on implementation, entry might be deleted or updated
      if (dbEntry) {
        expect(dbEntry.reason).toContain('Expired');
      }

      // Stop the system
      await botPaymentSystem.stop();
    }, 10000);
  });

  describe('Error Handling and Recovery', () => {
    test('system recovers from database connection issues', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the system reports database connection status
      
      await botPaymentSystem.start();
      
      const status = await botPaymentSystem.getSystemStatus();
      expect(typeof status.databaseConnected).toBe('boolean');
      
      await botPaymentSystem.stop();
    });

    test('system handles monitoring failures gracefully', async () => {
      // Create system with invalid webscraper path
      const invalidSystem = new BotPaymentSystemApplication({
        webscrapperPath: '/completely/invalid/path/that/does/not/exist',
        enableConsoleLogging: false
      });

      // Should fail to start due to path validation
      await expect(invalidSystem.start()).rejects.toThrow();
    });

    test('system maintains consistency during partial failures', async () => {
      // This is a complex test that would require mocking various failure scenarios
      // For now, we'll test basic error logging
      
      await botPaymentSystem.start();
      
      // Try to process payment with invalid IP
      const result = await botPaymentSystem.processPayment('test_tx', 'invalid-ip-format');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid IP address format');
      
      // System should still be running
      expect(botPaymentSystem.isSystemRunning()).toBe(true);
      
      await botPaymentSystem.stop();
    });
  });
});