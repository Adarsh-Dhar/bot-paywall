/**
 * Integration tests for complete X402 payment flow
 * Tests the end-to-end integration between webscraper, paywall worker, and bot payment system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as verifyPayment } from '@/app/api/x402-payment/verify/route';
import { POST as whitelistIP } from '@/app/api/x402-payment/whitelist/route';
import { startBotPaymentSystem, stopBotPaymentSystem, processManualPayment } from '@/lib/automated-bot-payment-system';

// Mock external dependencies
jest.mock('@/lib/automated-bot-payment-system', () => ({
  startBotPaymentSystem: jest.fn(),
  stopBotPaymentSystem: jest.fn(),
  processManualPayment: jest.fn(),
  getBotPaymentSystem: jest.fn(),
}));

const mockStartBotPaymentSystem = startBotPaymentSystem as jest.MockedFunction<typeof startBotPaymentSystem>;
const mockStopBotPaymentSystem = stopBotPaymentSystem as jest.MockedFunction<typeof stopBotPaymentSystem>;
const mockProcessManualPayment = processManualPayment as jest.MockedFunction<typeof processManualPayment>;

// Mock fetch for external API calls
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('X402 Payment Flow Integration Tests', () => {
  const testConfig = {
    clientIP: '210.212.2.133',
    paymentAddress: '0x1234567890abcdef1234567890abcdef12345678',
    paymentAmount: 0.01,
    paymentCurrency: 'MOVE',
    botPaymentSystemUrl: 'http://localhost:3000/api/x402-payment'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test complete X402 payment flow from bot detection to successful access
   */
  it('should complete full X402 payment flow successfully', async () => {
    // Step 1: Mock bot payment system initialization
    mockStartBotPaymentSystem.mockResolvedValue(undefined);
    
    // Step 2: Start the bot payment system
    await startBotPaymentSystem({
      configuredClientIP: testConfig.clientIP,
      enableConsoleLogging: true,
      enableFileLogging: false,
      cleanupDelayMs: 60000
    });

    expect(mockStartBotPaymentSystem).toHaveBeenCalledWith(
      expect.objectContaining({
        configuredClientIP: testConfig.clientIP
      })
    );

    // Step 3: Simulate webscraper receiving 402 Payment Required
    const paywall402Response = {
      status: 402,
      headers: {
        'WWW-Authenticate': 'X402-Payment',
        'X402-Payment-Address': testConfig.paymentAddress,
        'X402-Payment-Amount': testConfig.paymentAmount.toString(),
        'X402-Payment-Currency': testConfig.paymentCurrency,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Payment Required',
        message: 'Bot access requires X402 payment',
        payment_address: testConfig.paymentAddress,
        payment_amount: testConfig.paymentAmount,
        payment_currency: testConfig.paymentCurrency,
        client_ip: testConfig.clientIP
      })
    };

    // Verify 402 response structure
    expect(paywall402Response.status).toBe(402);
    expect(paywall402Response.headers['WWW-Authenticate']).toBe('X402-Payment');
    expect(paywall402Response.headers['X402-Payment-Address']).toBe(testConfig.paymentAddress);
    expect(paywall402Response.headers['X402-Payment-Amount']).toBe('0.01');
    expect(paywall402Response.headers['X402-Payment-Currency']).toBe('MOVE');

    // Step 4: Simulate webscraper making MOVE payment
    const transactionId = `0x${Date.now().toString(16)}${Math.random().toString(36).substr(2, 9)}`;
    
    // Step 5: Mock successful payment verification
    mockProcessManualPayment.mockResolvedValue({
      success: true,
      transactionId,
      whitelistRuleId: 'cf-rule-123',
      timestamp: new Date().toISOString()
    });

    // Step 6: Test payment verification API
    const verifyRequest = new NextRequest('http://localhost/api/x402-payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        transactionId,
        clientIP: testConfig.clientIP,
        expectedAmount: testConfig.paymentAmount,
        expectedCurrency: testConfig.paymentCurrency
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const verifyResponse = await verifyPayment(verifyRequest);
    const verifyData = await verifyResponse.json();

    expect(verifyResponse.status).toBe(200);
    expect(verifyData.verified).toBe(true);
    expect(verifyData.transactionId).toBe(transactionId);
    expect(verifyData.clientIP).toBe(testConfig.clientIP);
    expect(mockProcessManualPayment).toHaveBeenCalledWith(transactionId, testConfig.clientIP);

    // Step 7: Mock bot payment system for whitelisting
    const mockBotPaymentSystem = {
      processPayment: jest.fn().mockResolvedValue({
        success: true,
        whitelistRuleId: 'cf-rule-456',
        transactionId
      })
    };

    const { getBotPaymentSystem } = require('@/lib/automated-bot-payment-system');
    getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

    // Step 8: Test IP whitelisting API
    const whitelistRequest = new NextRequest('http://localhost/api/x402-payment/whitelist', {
      method: 'POST',
      body: JSON.stringify({
        transactionId,
        clientIP: testConfig.clientIP,
        duration: 60
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const whitelistResponse = await whitelistIP(whitelistRequest);
    const whitelistData = await whitelistResponse.json();

    expect(whitelistResponse.status).toBe(200);
    expect(whitelistData.success).toBe(true);
    expect(whitelistData.transactionId).toBe(transactionId);
    expect(whitelistData.clientIP).toBe(testConfig.clientIP);
    expect(whitelistData.whitelistRuleId).toBe('cf-rule-456');
    expect(mockBotPaymentSystem.processPayment).toHaveBeenCalledWith(transactionId, testConfig.clientIP);

    // Step 9: Simulate successful retry after whitelisting
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '<html><body>Success! Content accessible after payment.</body></html>',
      json: async () => ({ success: true })
    } as Response);

    const retryResponse = await fetch('https://paywall-worker.dharadarsh0.workers.dev/', {
      headers: {
        'User-Agent': 'Python-WebScraper/1.0 (Bot)'
      }
    });

    expect(retryResponse.status).toBe(200);
    const content = await retryResponse.text();
    expect(content).toContain('Success!');
    expect(content).toContain('Content accessible');

    // Step 10: Cleanup
    await stopBotPaymentSystem();
    expect(mockStopBotPaymentSystem).toHaveBeenCalled();
  });

  /**
   * Test payment verification failure scenarios
   */
  it('should handle payment verification failures gracefully', async () => {
    const invalidTransactionId = 'invalid-tx-123';

    // Mock failed payment verification
    mockProcessManualPayment.mockResolvedValue({
      success: false,
      error: 'Transaction not found on blockchain'
    });

    const verifyRequest = new NextRequest('http://localhost/api/x402-payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        transactionId: invalidTransactionId,
        clientIP: testConfig.clientIP,
        expectedAmount: testConfig.paymentAmount,
        expectedCurrency: testConfig.paymentCurrency
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const verifyResponse = await verifyPayment(verifyRequest);
    const verifyData = await verifyResponse.json();

    expect(verifyResponse.status).toBe(403);
    expect(verifyData.verified).toBe(false);
    expect(verifyData.error).toContain('Payment verification failed');
  });

  /**
   * Test invalid payment parameters
   */
  it('should reject invalid payment parameters', async () => {
    const testCases = [
      {
        description: 'incorrect amount',
        payload: {
          transactionId: 'valid-tx-123',
          clientIP: testConfig.clientIP,
          expectedAmount: 0.02, // Wrong amount
          expectedCurrency: testConfig.paymentCurrency
        },
        expectedStatus: 400,
        expectedError: 'Invalid payment parameters'
      },
      {
        description: 'incorrect currency',
        payload: {
          transactionId: 'valid-tx-123',
          clientIP: testConfig.clientIP,
          expectedAmount: testConfig.paymentAmount,
          expectedCurrency: 'BTC' // Wrong currency
        },
        expectedStatus: 400,
        expectedError: 'Invalid payment parameters'
      },
      {
        description: 'missing transaction ID',
        payload: {
          clientIP: testConfig.clientIP,
          expectedAmount: testConfig.paymentAmount,
          expectedCurrency: testConfig.paymentCurrency
        },
        expectedStatus: 400,
        expectedError: 'Missing required fields'
      },
      {
        description: 'missing client IP',
        payload: {
          transactionId: 'valid-tx-123',
          expectedAmount: testConfig.paymentAmount,
          expectedCurrency: testConfig.paymentCurrency
        },
        expectedStatus: 400,
        expectedError: 'Missing required fields'
      }
    ];

    for (const testCase of testCases) {
      const request = new NextRequest('http://localhost/api/x402-payment/verify', {
        method: 'POST',
        body: JSON.stringify(testCase.payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await verifyPayment(request);
      const data = await response.json();

      expect(response.status).toBe(testCase.expectedStatus);
      expect(data.verified).toBe(false);
      expect(data.error).toContain(testCase.expectedError);
    }
  });

  /**
   * Test system error handling
   */
  it('should handle system errors gracefully', async () => {
    const transactionId = 'test-tx-123';

    // Mock system error
    mockProcessManualPayment.mockRejectedValue(new Error('Database connection failed'));

    const verifyRequest = new NextRequest('http://localhost/api/x402-payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        transactionId,
        clientIP: testConfig.clientIP,
        expectedAmount: testConfig.paymentAmount,
        expectedCurrency: testConfig.paymentCurrency
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const verifyResponse = await verifyPayment(verifyRequest);
    const verifyData = await verifyResponse.json();

    expect(verifyResponse.status).toBe(500);
    expect(verifyData.verified).toBe(false);
    expect(verifyData.error).toContain('Internal server error');
  });

  /**
   * Test IP whitelisting failure scenarios
   */
  it('should handle IP whitelisting failures', async () => {
    const transactionId = 'test-tx-456';

    // Mock bot payment system unavailable
    const { getBotPaymentSystem } = require('@/lib/automated-bot-payment-system');
    getBotPaymentSystem.mockReturnValue(null);

    const whitelistRequest = new NextRequest('http://localhost/api/x402-payment/whitelist', {
      method: 'POST',
      body: JSON.stringify({
        transactionId,
        clientIP: testConfig.clientIP,
        duration: 60
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const whitelistResponse = await whitelistIP(whitelistRequest);
    const whitelistData = await whitelistResponse.json();

    expect(whitelistResponse.status).toBe(503);
    expect(whitelistData.success).toBe(false);
    expect(whitelistData.error).toContain('Bot payment system not initialized');
  });

  /**
   * Test concurrent payment processing
   */
  it('should handle concurrent payment processing correctly', async () => {
    const transactionIds = [
      'concurrent-tx-1',
      'concurrent-tx-2', 
      'concurrent-tx-3'
    ];

    // Mock successful payment verification for all transactions
    mockProcessManualPayment.mockImplementation((txId) => 
      Promise.resolve({
        success: true,
        transactionId: txId,
        whitelistRuleId: `cf-rule-${txId}`,
        timestamp: new Date().toISOString()
      })
    );

    // Process all payments concurrently
    const verifyPromises = transactionIds.map(txId => {
      const request = new NextRequest('http://localhost/api/x402-payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: txId,
          clientIP: testConfig.clientIP,
          expectedAmount: testConfig.paymentAmount,
          expectedCurrency: testConfig.paymentCurrency
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return verifyPayment(request);
    });

    const responses = await Promise.all(verifyPromises);
    const responseData = await Promise.all(responses.map(r => r.json()));

    // All should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    responseData.forEach((data, index) => {
      expect(data.verified).toBe(true);
      expect(data.transactionId).toBe(transactionIds[index]);
      expect(data.clientIP).toBe(testConfig.clientIP);
    });

    // Verify all payment verifications were called
    expect(mockProcessManualPayment).toHaveBeenCalledTimes(3);
  });

  /**
   * Test end-to-end timing and cleanup
   */
  it('should handle timing and cleanup correctly', async () => {
    const transactionId = 'timing-test-tx';

    // Mock successful operations with timing
    mockProcessManualPayment.mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            transactionId,
            whitelistRuleId: 'cf-rule-timing',
            timestamp: new Date().toISOString()
          });
        }, 100); // 100ms delay
      })
    );

    const mockBotPaymentSystem = {
      processPayment: jest.fn().mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              whitelistRuleId: 'cf-rule-timing-2',
              transactionId
            });
          }, 50); // 50ms delay
        })
      )
    };

    const { getBotPaymentSystem } = require('@/lib/automated-bot-payment-system');
    getBotPaymentSystem.mockReturnValue(mockBotPaymentSystem);

    const startTime = Date.now();

    // Verify payment
    const verifyRequest = new NextRequest('http://localhost/api/x402-payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        transactionId,
        clientIP: testConfig.clientIP,
        expectedAmount: testConfig.paymentAmount,
        expectedCurrency: testConfig.paymentCurrency
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const verifyResponse = await verifyPayment(verifyRequest);
    const verifyTime = Date.now() - startTime;

    expect(verifyResponse.status).toBe(200);
    expect(verifyTime).toBeGreaterThanOrEqual(100); // Should take at least 100ms

    // Whitelist IP
    const whitelistRequest = new NextRequest('http://localhost/api/x402-payment/whitelist', {
      method: 'POST',
      body: JSON.stringify({
        transactionId,
        clientIP: testConfig.clientIP,
        duration: 60
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const whitelistStartTime = Date.now();
    const whitelistResponse = await whitelistIP(whitelistRequest);
    const whitelistTime = Date.now() - whitelistStartTime;

    expect(whitelistResponse.status).toBe(200);
    expect(whitelistTime).toBeGreaterThanOrEqual(50); // Should take at least 50ms

    const whitelistData = await whitelistResponse.json();
    expect(whitelistData.success).toBe(true);
    expect(whitelistData.duration).toBe(60);
    
    // Verify expiration time is set correctly (60 seconds from now)
    const expiresAt = new Date(whitelistData.expiresAt);
    const expectedExpiry = new Date(Date.now() + 60000);
    const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds tolerance
  });
});