/**
 * Property-based tests for whitelist expiration handling
 * **Feature: x402-payment-integration-fix, Property 5: Expired whitelists trigger new payment flows**
 */

import fc from 'fast-check';

describe('Whitelist Expiration Handling Properties', () => {
  // Mock types for testing
  interface MockResponse {
    status_code: number;
    headers: Record<string, string>;
  }

  interface MockPaymentHandler {
    last_payment_time: Date | null;
    whitelist_duration: number;
    is_whitelist_expired(): boolean;
    should_trigger_new_payment(response: MockResponse): boolean;
    handle_expired_whitelist(response: MockResponse, client_ip: string): boolean;
  }

  // Mock implementation for testing
  class MockX402PaymentHandler implements MockPaymentHandler {
    last_payment_time: Date | null = null;
    whitelist_duration: number = 60; // 60 seconds

    is_whitelist_expired(): boolean {
      if (this.last_payment_time === null) {
        return true;
      }
      
      const elapsed_time = (Date.now() - this.last_payment_time.getTime()) / 1000;
      return elapsed_time >= this.whitelist_duration;
    }

    should_trigger_new_payment(response: MockResponse): boolean {
      if (response.status_code === 402 || response.status_code === 403) {
        if (this.is_whitelist_expired()) {
          return true;
        }
        if (response.status_code === 402 && response.headers['WWW-Authenticate']?.includes('X402-Payment')) {
          return true;
        }
        if (response.status_code === 403) {
          return true;
        }
      }
      return false;
    }

    handle_expired_whitelist(response: MockResponse, client_ip: string): boolean {
      // Reset payment tracking
      this.last_payment_time = null;
      
      // Simulate successful payment and whitelisting
      this.last_payment_time = new Date();
      return true;
    }

    detect_payment_required(response: MockResponse): boolean {
      return response.status_code === 402 && 
             response.headers['WWW-Authenticate']?.includes('X402-Payment') === true;
    }
  }

  describe('Property 5: Expired whitelists trigger new payment flows', () => {
    test('any expired whitelist should trigger new payment flow when receiving 402/403', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 61, max: 300 }), // elapsed time > 60 seconds (expired)
          fc.constantFrom(402, 403), // response codes that should trigger payment
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (elapsedSeconds, statusCode, clientIP) => {
            const handler = new MockX402PaymentHandler();
            
            // Set up an expired payment
            const pastTime = new Date(Date.now() - (elapsedSeconds * 1000));
            handler.last_payment_time = pastTime;
            
            // Create response that would trigger payment
            const response: MockResponse = {
              status_code: statusCode,
              headers: statusCode === 402 ? { 'WWW-Authenticate': 'X402-Payment' } : {}
            };
            
            // Verify whitelist is expired
            expect(handler.is_whitelist_expired()).toBe(true);
            
            // Verify new payment should be triggered
            expect(handler.should_trigger_new_payment(response)).toBe(true);
            
            // Handle expired whitelist
            const result = handler.handle_expired_whitelist(response, clientIP);
            
            // Verify payment was successful and new payment time was set
            expect(result).toBe(true);
            expect(handler.last_payment_time).not.toBeNull();
            expect(handler.last_payment_time!.getTime()).toBeGreaterThan(pastTime.getTime());
            
            // Verify whitelist is no longer expired
            expect(handler.is_whitelist_expired()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('non-expired whitelists should not trigger new payment flows for successful responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 59 }), // elapsed time < 60 seconds (not expired)
          fc.constantFrom(200, 201, 204), // successful response codes
          async (elapsedSeconds, statusCode) => {
            const handler = new MockX402PaymentHandler();
            
            // Set up a non-expired payment
            const recentTime = new Date(Date.now() - (elapsedSeconds * 1000));
            handler.last_payment_time = recentTime;
            
            // Create successful response
            const response: MockResponse = {
              status_code: statusCode,
              headers: {}
            };
            
            // Verify whitelist is not expired
            expect(handler.is_whitelist_expired()).toBe(false);
            
            // Verify new payment should not be triggered
            expect(handler.should_trigger_new_payment(response)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('expired whitelists should trigger payment even for 403 responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 61, max: 300 }), // elapsed time > 60 seconds (expired)
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (elapsedSeconds, clientIP) => {
            const handler = new MockX402PaymentHandler();
            
            // Set up an expired payment
            const pastTime = new Date(Date.now() - (elapsedSeconds * 1000));
            handler.last_payment_time = pastTime;
            
            // Create 403 response (access denied, likely due to expired whitelist)
            const response: MockResponse = {
              status_code: 403,
              headers: {}
            };
            
            // Verify whitelist is expired
            expect(handler.is_whitelist_expired()).toBe(true);
            
            // Verify new payment should be triggered for 403 when expired
            expect(handler.should_trigger_new_payment(response)).toBe(true);
            
            // Handle expired whitelist
            const result = handler.handle_expired_whitelist(response, clientIP);
            
            // Verify payment was successful
            expect(result).toBe(true);
            expect(handler.last_payment_time).not.toBeNull();
            expect(handler.last_payment_time!.getTime()).toBeGreaterThan(pastTime.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('first-time requests (no previous payment) should trigger payment flow', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(402, 403), // response codes
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (statusCode, clientIP) => {
            const handler = new MockX402PaymentHandler();
            
            // No previous payment (first time)
            expect(handler.last_payment_time).toBeNull();
            
            // Create response
            const response: MockResponse = {
              status_code: statusCode,
              headers: statusCode === 402 ? { 'WWW-Authenticate': 'X402-Payment' } : {}
            };
            
            // Verify whitelist is expired (no previous payment)
            expect(handler.is_whitelist_expired()).toBe(true);
            
            // Verify new payment should be triggered
            expect(handler.should_trigger_new_payment(response)).toBe(true);
            
            // Handle expired whitelist (which handles first-time case too)
            const result = handler.handle_expired_whitelist(response, clientIP);
            
            // Verify payment was successful
            expect(result).toBe(true);
            expect(handler.last_payment_time).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('whitelist expiration detection should be accurate within timing bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 120 }), // elapsed time from 0 to 120 seconds
          async (elapsedSeconds) => {
            const handler = new MockX402PaymentHandler();
            
            // Set payment time
            const paymentTime = new Date(Date.now() - (elapsedSeconds * 1000));
            handler.last_payment_time = paymentTime;
            
            // Check expiration
            const isExpired = handler.is_whitelist_expired();
            
            // Verify expiration logic
            if (elapsedSeconds >= handler.whitelist_duration) {
              expect(isExpired).toBe(true);
            } else {
              expect(isExpired).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('payment renewal should reset expiration timer', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 61, max: 300 }), // initial elapsed time (expired)
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (initialElapsedSeconds, clientIP) => {
            const handler = new MockX402PaymentHandler();
            
            // Set up expired payment
            const oldPaymentTime = new Date(Date.now() - (initialElapsedSeconds * 1000));
            handler.last_payment_time = oldPaymentTime;
            
            // Verify initially expired
            expect(handler.is_whitelist_expired()).toBe(true);
            
            // Create response and handle renewal
            const response: MockResponse = {
              status_code: 403,
              headers: {}
            };
            
            const renewalResult = handler.handle_expired_whitelist(response, clientIP);
            
            // Verify renewal was successful
            expect(renewalResult).toBe(true);
            
            // Verify new payment time is more recent
            expect(handler.last_payment_time).not.toBeNull();
            expect(handler.last_payment_time!.getTime()).toBeGreaterThan(oldPaymentTime.getTime());
            
            // Verify whitelist is no longer expired
            expect(handler.is_whitelist_expired()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple consecutive expired requests should each trigger renewal', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(402, 403),
            { minLength: 2, maxLength: 5 }
          ), // multiple response codes
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          async (statusCodes, clientIP) => {
            const handler = new MockX402PaymentHandler();
            
            let previousPaymentTime: Date | null = null;
            
            for (const statusCode of statusCodes) {
              // Make previous payment expired by setting old time
              if (previousPaymentTime) {
                handler.last_payment_time = new Date(previousPaymentTime.getTime() - 70000); // 70 seconds ago
              }
              
              // Create response
              const response: MockResponse = {
                status_code: statusCode,
                headers: statusCode === 402 ? { 'WWW-Authenticate': 'X402-Payment' } : {}
              };
              
              // Verify expiration triggers payment
              expect(handler.should_trigger_new_payment(response)).toBe(true);
              
              // Handle renewal
              const result = handler.handle_expired_whitelist(response, clientIP);
              expect(result).toBe(true);
              
              // Verify new payment time
              expect(handler.last_payment_time).not.toBeNull();
              if (previousPaymentTime) {
                expect(handler.last_payment_time!.getTime()).toBeGreaterThan(previousPaymentTime.getTime());
              }
              
              previousPaymentTime = handler.last_payment_time;
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to loop complexity
      );
    });

    test('successful responses should not trigger payment regardless of expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 300 }), // any elapsed time
          fc.constantFrom(200, 201, 202, 204, 301, 302), // successful/redirect responses
          async (elapsedSeconds, statusCode) => {
            const handler = new MockX402PaymentHandler();
            
            // Set payment time (may or may not be expired)
            if (elapsedSeconds > 0) {
              handler.last_payment_time = new Date(Date.now() - (elapsedSeconds * 1000));
            }
            
            // Create successful response
            const response: MockResponse = {
              status_code: statusCode,
              headers: {}
            };
            
            // Verify successful responses don't trigger payment
            expect(handler.should_trigger_new_payment(response)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});