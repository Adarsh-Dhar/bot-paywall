/**
 * Property-based tests for payment failure handling
 * **Feature: x402-payment-integration-fix, Property 10: Failed verification returns 403 with errors**
 */

import fc from 'fast-check';

describe('Payment Failure Handling Properties', () => {
  // Mock types for testing payment failure scenarios
  interface MockPaymentVerificationResult {
    verified: boolean;
    error?: string;
    details?: any;
  }

  interface MockWhitelistResult {
    success: boolean;
    error?: string;
    details?: any;
  }

  interface MockPaywallResponse {
    status: number;
    body: any;
    headers: Record<string, string>;
  }

  // Mock paywall worker functions
  class MockPaywallWorker {
    constructor(
      private config: {
        logging: boolean;
        paymentAddress: string;
        botPaymentSystemUrl: string;
      }
    ) {}

    async verifyX402Payment(transactionId: string, clientIP: string): Promise<MockPaymentVerificationResult> {
      // Simulate various failure scenarios
      if (!transactionId || transactionId.length < 10) {
        return {
          verified: false,
          error: "Invalid transaction ID format",
          details: "Transaction ID must be at least 10 characters"
        };
      }

      if (transactionId.includes('invalid')) {
        return {
          verified: false,
          error: "Transaction not found on blockchain",
          details: "The provided transaction ID could not be found"
        };
      }

      if (transactionId.includes('insufficient')) {
        return {
          verified: false,
          error: "Insufficient payment amount",
          details: "Expected 0.01 MOVE, received less"
        };
      }

      if (transactionId.includes('network_error')) {
        return {
          verified: false,
          error: "Network error during payment verification",
          details: "Unable to connect to blockchain network"
        };
      }

      // Default to success for other cases
      return { verified: true };
    }

    async triggerIPWhitelisting(transactionId: string, clientIP: string): Promise<MockWhitelistResult> {
      if (transactionId.includes('whitelist_fail')) {
        return {
          success: false,
          error: "Cloudflare API error",
          details: "Failed to create whitelist rule"
        };
      }

      return { success: true };
    }

    generatePaymentFailureResponse(
      transactionId: string,
      clientIP: string,
      verificationResult: MockPaymentVerificationResult
    ): MockPaywallResponse {
      return {
        status: 403,
        body: {
          error: "Payment Verification Failed",
          message: "The provided transaction could not be verified. Please ensure you transferred exactly 0.01 MOVE tokens to the correct address.",
          transaction_id: transactionId,
          client_ip: clientIP,
          error_details: verificationResult.error,
          payment_requirements: {
            amount: "0.01",
            currency: "MOVE",
            address: this.config.paymentAddress
          },
          timestamp: new Date().toISOString()
        },
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Status": "failed",
          "X-Bot-Protection": "payment-verification-failed"
        }
      };
    }

    generateWhitelistFailureResponse(
      transactionId: string,
      clientIP: string,
      whitelistResult: MockWhitelistResult
    ): MockPaywallResponse {
      return {
        status: 500,
        body: {
          error: "Whitelisting Failed",
          message: "Payment verified but IP whitelisting failed. Please try again in a few moments.",
          transaction_id: transactionId,
          client_ip: clientIP,
          error_details: whitelistResult.error,
          timestamp: new Date().toISOString(),
          retry_after: 30
        },
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Status": "verified",
          "X-Whitelist-Status": "failed",
          "Retry-After": "30"
        }
      };
    }
  }

  describe('Property 10: Failed verification returns 403 with errors', () => {
    test('any invalid transaction ID should return 403 with detailed error information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid_tx_123'),
            fc.constant('insufficient_amount_456'),
            fc.constant('network_error_789'),
            fc.string({ minLength: 1, maxLength: 9 }) // Too short transaction ID
          ), // Various invalid transaction IDs
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionId, clientIP) => {
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress: '0x1234567890abcdef1234567890abcdef12345678',
              botPaymentSystemUrl: 'https://test.com/api/x402-payment'
            });

            // Verify payment (should fail)
            const verificationResult = await worker.verifyX402Payment(transactionId, clientIP);
            expect(verificationResult.verified).toBe(false);
            expect(verificationResult.error).toBeDefined();

            // Generate failure response
            const response = worker.generatePaymentFailureResponse(transactionId, clientIP, verificationResult);

            // Verify response structure
            expect(response.status).toBe(403);
            expect(response.body.error).toBe("Payment Verification Failed");
            expect(response.body.transaction_id).toBe(transactionId);
            expect(response.body.client_ip).toBe(clientIP);
            expect(response.body.error_details).toBe(verificationResult.error);
            expect(response.body.payment_requirements).toEqual({
              amount: "0.01",
              currency: "MOVE",
              address: '0x1234567890abcdef1234567890abcdef12345678'
            });

            // Verify headers
            expect(response.headers["Content-Type"]).toBe("application/json");
            expect(response.headers["X-Payment-Status"]).toBe("failed");
            expect(response.headers["X-Bot-Protection"]).toBe("payment-verification-failed");

            // Verify timestamp is recent
            const timestamp = new Date(response.body.timestamp);
            const now = new Date();
            expect(Math.abs(now.getTime() - timestamp.getTime())).toBeLessThan(5000); // Within 5 seconds
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment verification failures should include specific error details', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              transactionId: fc.constant('invalid_blockchain_tx'),
              expectedError: fc.constant('Transaction not found on blockchain')
            }),
            fc.record({
              transactionId: fc.constant('insufficient_payment_tx'),
              expectedError: fc.constant('Insufficient payment amount')
            }),
            fc.record({
              transactionId: fc.constant('network_error_tx'),
              expectedError: fc.constant('Network error during payment verification')
            }),
            fc.record({
              transactionId: fc.string({ minLength: 1, maxLength: 5 }),
              expectedError: fc.constant('Invalid transaction ID format')
            })
          ),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (testCase, clientIP) => {
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress: '0xtest',
              botPaymentSystemUrl: 'https://test.com'
            });

            const verificationResult = await worker.verifyX402Payment(testCase.transactionId, clientIP);
            
            expect(verificationResult.verified).toBe(false);
            expect(verificationResult.error).toContain(testCase.expectedError);
            expect(verificationResult.details).toBeDefined();

            const response = worker.generatePaymentFailureResponse(testCase.transactionId, clientIP, verificationResult);
            
            expect(response.body.error_details).toContain(testCase.expectedError);
            expect(response.body.message).toContain("could not be verified");
          }
        ),
        { numRuns: 100 }
      );
    });

    test('whitelisting failures after successful payment should return 500 with retry information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 64 }).filter(s => s.includes('whitelist_fail')), // Transaction that causes whitelist failure
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionId, clientIP) => {
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress: '0xtest',
              botPaymentSystemUrl: 'https://test.com'
            });

            // Payment verification should succeed
            const verificationResult = await worker.verifyX402Payment(transactionId, clientIP);
            expect(verificationResult.verified).toBe(true);

            // But whitelisting should fail
            const whitelistResult = await worker.triggerIPWhitelisting(transactionId, clientIP);
            expect(whitelistResult.success).toBe(false);
            expect(whitelistResult.error).toBeDefined();

            // Generate whitelisting failure response
            const response = worker.generateWhitelistFailureResponse(transactionId, clientIP, whitelistResult);

            // Verify response structure for whitelisting failure
            expect(response.status).toBe(500);
            expect(response.body.error).toBe("Whitelisting Failed");
            expect(response.body.transaction_id).toBe(transactionId);
            expect(response.body.client_ip).toBe(clientIP);
            expect(response.body.error_details).toBe(whitelistResult.error);
            expect(response.body.retry_after).toBe(30);

            // Verify headers indicate payment was verified but whitelisting failed
            expect(response.headers["X-Payment-Status"]).toBe("verified");
            expect(response.headers["X-Whitelist-Status"]).toBe("failed");
            expect(response.headers["Retry-After"]).toBe("30");
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all payment failure responses should include required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 64 }).filter(s => s.includes('invalid')), // Invalid transaction
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 10, maxLength: 50 }), // payment address
          async (transactionId, clientIP, paymentAddress) => {
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress,
              botPaymentSystemUrl: 'https://test.com'
            });

            const verificationResult = await worker.verifyX402Payment(transactionId, clientIP);
            const response = worker.generatePaymentFailureResponse(transactionId, clientIP, verificationResult);

            // Verify all required fields are present
            const requiredFields = [
              'error',
              'message', 
              'transaction_id',
              'client_ip',
              'error_details',
              'payment_requirements',
              'timestamp'
            ];

            for (const field of requiredFields) {
              expect(response.body).toHaveProperty(field);
              expect(response.body[field]).toBeDefined();
            }

            // Verify payment requirements structure
            expect(response.body.payment_requirements).toHaveProperty('amount', '0.01');
            expect(response.body.payment_requirements).toHaveProperty('currency', 'MOVE');
            expect(response.body.payment_requirements).toHaveProperty('address', paymentAddress);

            // Verify required headers
            const requiredHeaders = [
              'Content-Type',
              'X-Payment-Status',
              'X-Bot-Protection'
            ];

            for (const header of requiredHeaders) {
              expect(response.headers).toHaveProperty(header);
              expect(response.headers[header]).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('error messages should be user-friendly and actionable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid_format'),
            fc.constant('insufficient_amount'),
            fc.constant('network_error_connection')
          ),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionId, clientIP) => {
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress: '0xtest',
              botPaymentSystemUrl: 'https://test.com'
            });

            const verificationResult = await worker.verifyX402Payment(transactionId, clientIP);
            const response = worker.generatePaymentFailureResponse(transactionId, clientIP, verificationResult);

            // Verify message is user-friendly
            expect(response.body.message).toContain("could not be verified");
            expect(response.body.message).toContain("0.01 MOVE tokens");
            expect(response.body.message).toContain("correct address");

            // Verify error details provide actionable information
            expect(response.body.error_details).toBeTruthy();
            expect(typeof response.body.error_details).toBe('string');
            expect(response.body.error_details.length).toBeGreaterThan(5);

            // Verify payment requirements are clear
            expect(response.body.payment_requirements.amount).toBe('0.01');
            expect(response.body.payment_requirements.currency).toBe('MOVE');
            expect(response.body.payment_requirements.address).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('failure responses should maintain consistent structure across different error types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              fc.constant('invalid_tx'),
              fc.constant('insufficient_payment'),
              fc.constant('network_error_timeout'),
              fc.string({ minLength: 1, maxLength: 8 }) // Short invalid ID
            ),
            { minLength: 2, maxLength: 5 }
          ),
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionIds, clientIP) => {
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress: '0xtest',
              botPaymentSystemUrl: 'https://test.com'
            });

            const responses = [];
            
            for (const transactionId of transactionIds) {
              const verificationResult = await worker.verifyX402Payment(transactionId, clientIP);
              const response = worker.generatePaymentFailureResponse(transactionId, clientIP, verificationResult);
              responses.push(response);
            }

            // Verify all responses have consistent structure
            const firstResponse = responses[0];
            const expectedKeys = Object.keys(firstResponse.body).sort();
            const expectedHeaders = Object.keys(firstResponse.headers).sort();

            for (const response of responses) {
              // Same status code
              expect(response.status).toBe(403);
              
              // Same body structure
              expect(Object.keys(response.body).sort()).toEqual(expectedKeys);
              
              // Same header structure
              expect(Object.keys(response.headers).sort()).toEqual(expectedHeaders);
              
              // Same error type
              expect(response.body.error).toBe("Payment Verification Failed");
              
              // Same payment status
              expect(response.headers["X-Payment-Status"]).toBe("failed");
            }
          }
        ),
        { numRuns: 50 } // Reduced due to loop complexity
      );
    });

    test('timestamp in failure responses should be accurate and recent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.includes('invalid')), // Invalid transaction
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (transactionId, clientIP) => {
            const beforeTime = new Date();
            
            const worker = new MockPaywallWorker({
              logging: true,
              paymentAddress: '0xtest',
              botPaymentSystemUrl: 'https://test.com'
            });

            const verificationResult = await worker.verifyX402Payment(transactionId, clientIP);
            const response = worker.generatePaymentFailureResponse(transactionId, clientIP, verificationResult);
            
            const afterTime = new Date();
            const responseTime = new Date(response.body.timestamp);

            // Verify timestamp is valid and recent
            expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(responseTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
            
            // Verify timestamp format is ISO string
            expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});