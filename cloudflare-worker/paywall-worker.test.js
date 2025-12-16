/**
 * Property-based tests for Cloudflare Worker API interface consistency
 * **Feature: dummy-transaction-mode, Property 3: API interface consistency**
 * **Validates: Requirements 1.4**
 */

const fc = require('fast-check');

// Import the CommonJS version of the worker for testing
const workerModule = require('./paywall-worker-cjs.js');

// Mock environment for testing
const mockEnv = {};
const mockCtx = {
  waitUntil: jest.fn(),
  passThroughOnException: jest.fn()
};

describe('Cloudflare Worker API Interface Consistency', () => {
  
  /**
   * Property 3: API interface consistency
   * For any payment verification function, the function signatures and return types 
   * should be identical between real and dummy modes
   */
  test('should maintain consistent API responses for payment verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random transaction hashes
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          // Test request without payment hash (should return 402)
          const requestWithoutPayment = new Request('https://example.com');
          const responseWithoutPayment = await workerModule.fetch(
            requestWithoutPayment, 
            mockEnv, 
            mockCtx
          );
          
          // Verify 402 response structure
          expect(responseWithoutPayment.status).toBe(402);
          expect(responseWithoutPayment.headers.get('Content-Type')).toBe('application/json');
          
          const paymentRequiredBody = await responseWithoutPayment.json();
          expect(paymentRequiredBody).toHaveProperty('error');
          expect(paymentRequiredBody).toHaveProperty('message');
          expect(paymentRequiredBody).toHaveProperty('payment_address');
          expect(paymentRequiredBody).toHaveProperty('price_move');
          expect(paymentRequiredBody).toHaveProperty('chain_id');
          
          // Test request with payment hash
          const requestWithPayment = new Request('https://example.com', {
            headers: { 'X-Payment-Hash': txHash }
          });
          const responseWithPayment = await workerModule.fetch(
            requestWithPayment, 
            mockEnv, 
            mockCtx
          );
          
          // Response should be either 200 (valid), 403 (invalid), or 500 (error)
          expect([200, 403, 500]).toContain(responseWithPayment.status);
          
          // Verify response structure based on status
          if (responseWithPayment.status === 200) {
            const successBody = await responseWithPayment.text();
            expect(successBody).toContain('ACCESS GRANTED');
          } else if (responseWithPayment.status === 403) {
            const failureBody = await responseWithPayment.text();
            expect(failureBody).toContain('Invalid or Insufficient Payment');
          } else if (responseWithPayment.status === 500) {
            const errorBody = await responseWithPayment.text();
            expect(errorBody).toContain('Verification Error');
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  test('should maintain consistent response headers across all scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }), { nil: null }),
        async (txHash) => {
          const headers = txHash ? { 'X-Payment-Hash': txHash } : {};
          const request = new Request('https://example.com', { headers });
          
          const response = await workerModule.fetch(request, mockEnv, mockCtx);
          
          // All responses should have consistent header structure
          expect(response.headers).toBeDefined();
          
          // 402 responses should have Content-Type: application/json
          if (response.status === 402) {
            expect(response.headers.get('Content-Type')).toBe('application/json');
          }
          
          // Response should always be a valid Response object
          expect(response).toBeInstanceOf(Response);
          expect(typeof response.status).toBe('number');
          expect(response.status >= 200 && response.status < 600).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should generate deterministic dummy transactions for same hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        async (txHash) => {
          // Make two requests with the same transaction hash
          const request1 = new Request('https://example.com', {
            headers: { 'X-Payment-Hash': txHash }
          });
          const request2 = new Request('https://example.com', {
            headers: { 'X-Payment-Hash': txHash }
          });
          
          const response1 = await workerModule.fetch(request1, mockEnv, mockCtx);
          const response2 = await workerModule.fetch(request2, mockEnv, mockCtx);
          
          // Both responses should have the same status (deterministic behavior)
          expect(response1.status).toBe(response2.status);
          
          // Both responses should have the same body content
          const body1 = await response1.text();
          const body2 = await response2.text();
          expect(body1).toBe(body2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle edge cases in transaction hash format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 10 }), // short string
          fc.string({ minLength: 100, maxLength: 200 }), // long string
          fc.hexaString({ minLength: 32, maxLength: 32 }), // 32 char hex
          fc.string().filter(s => s.length > 0 && !/^[0-9a-fA-F]*$/.test(s)) // non-hex string (non-empty)
        ),
        async (invalidTxHash) => {
          const request = new Request('https://example.com', {
            headers: { 'X-Payment-Hash': invalidTxHash }
          });
          
          const response = await workerModule.fetch(request, mockEnv, mockCtx);
          
          // Should handle invalid hashes gracefully (not crash)
          expect(response).toBeInstanceOf(Response);
          expect(typeof response.status).toBe('number');
          
          // Should return either 403 (invalid) or 500 (error), never 200
          expect([403, 500]).toContain(response.status);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should return 402 for empty or missing transaction hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''), // empty string
          fc.constant(null), // null value
          fc.constant(undefined) // undefined value
        ),
        async (emptyTxHash) => {
          const headers = emptyTxHash ? { 'X-Payment-Hash': emptyTxHash } : {};
          const request = new Request('https://example.com', { headers });
          
          const response = await workerModule.fetch(request, mockEnv, mockCtx);
          
          // Should return 402 Payment Required for missing/empty hash
          expect(response.status).toBe(402);
          expect(response.headers.get('Content-Type')).toBe('application/json');
          
          const body = await response.json();
          expect(body).toHaveProperty('error', 'Payment Required');
        }
      ),
      { numRuns: 20 }
    );
  });
});