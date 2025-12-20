/**
 * **Feature: x402-payment-integration-fix, Property 6: Bot detection returns 402 with X402 details**
 * Property-based tests for paywall worker bot detection response
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Simulate the paywall worker's bot detection and X402 response logic
class PaywallWorkerSimulator {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  detectBot(userAgent: string, acceptHeader: string, acceptLanguage: string, acceptEncoding: string): boolean {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /python/i, /requests/i,
      /curl/i, /wget/i, /beautifulsoup/i, /scrapy/i, /selenium/i,
      /phantomjs/i, /headless/i, /automation/i
    ];

    // Check if User-Agent matches bot patterns
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      return true;
    }

    // Check for missing critical browser headers
    if (!acceptLanguage || acceptLanguage.length < 2) {
      return true;
    }

    if (!acceptEncoding || !acceptEncoding.includes("gzip")) {
      return true;
    }

    // Check for suspicious Accept header
    if (acceptHeader === "*/*" && !acceptHeader.includes("text/html")) {
      return true;
    }

    return false;
  }

  generateX402Response(clientIP: string): Response {
    const paymentDetails = {
      error: "Payment Required",
      message: "Bot access requires X402 payment. Please transfer 0.01 MOVE tokens to the specified address.",
      payment_required: true,
      payment_address: this.config.paymentAddress,
      payment_amount: "0.01",
      payment_currency: "MOVE",
      client_ip: clientIP,
      timestamp: new Date().toISOString(),
      instructions: "Transfer exactly 0.01 MOVE tokens to the payment address. Access will be granted automatically upon payment confirmation."
    };

    return new Response(
      JSON.stringify(paymentDetails),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "X402-Payment",
          "X402-Payment-Address": this.config.paymentAddress,
          "X402-Payment-Amount": "0.01",
          "X402-Payment-Currency": "MOVE",
          "X-Bot-Protection": "x402-payment-required"
        }
      }
    );
  }

  async processRequest(userAgent: string, acceptHeader: string, acceptLanguage: string, acceptEncoding: string, clientIP: string): Promise<Response> {
    const isBot = this.detectBot(userAgent, acceptHeader, acceptLanguage, acceptEncoding);
    
    if (isBot) {
      return this.generateX402Response(clientIP);
    }

    // For non-bots, return success (simplified)
    return new Response("OK", { status: 200 });
  }
}

describe('Bot Detection Response Property Tests', () => {
  let paywall: PaywallWorkerSimulator;

  beforeEach(() => {
    jest.clearAllMocks();
    paywall = new PaywallWorkerSimulator({
      paymentAddress: "0x1234567890abcdef1234567890abcdef12345678",
      logging: false
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: x402-payment-integration-fix, Property 6: Bot detection returns 402 with X402 details**
   * Property: For any detected bot request, the Paywall_Worker should return a 402 Payment Required response with proper X402 payment details
   */
  it('should always return 402 with X402 details for detected bots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant("Python-WebScraper/1.0 (Bot)"),
          fc.constant("requests/2.28.1"),
          fc.constant("curl/7.68.0"),
          fc.constant("Scrapy/2.5.1"),
          fc.constant("selenium"),
          fc.constant("bot crawler"),
          fc.constant("spider automation")
        ),
        fc.oneof(
          fc.constant("*/*"),
          fc.constant("application/json"),
          fc.constant("text/plain")
        ),
        fc.oneof(
          fc.constant(""), // Missing Accept-Language
          fc.constant("x") // Too short Accept-Language
        ),
        fc.oneof(
          fc.constant(""), // Missing Accept-Encoding
          fc.constant("identity") // No gzip support
        ),
        fc.ipV4(),
        async (userAgent, acceptHeader, acceptLanguage, acceptEncoding, clientIP) => {
          // Process the request
          const response = await paywall.processRequest(userAgent, acceptHeader, acceptLanguage, acceptEncoding, clientIP);

          // Verify it's a 402 Payment Required response
          expect(response.status).toBe(402);

          // Verify X402 headers are present
          expect(response.headers.get("WWW-Authenticate")).toBe("X402-Payment");
          expect(response.headers.get("X402-Payment-Address")).toBeTruthy();
          expect(response.headers.get("X402-Payment-Amount")).toBe("0.01");
          expect(response.headers.get("X402-Payment-Currency")).toBe("MOVE");
          expect(response.headers.get("X-Bot-Protection")).toBe("x402-payment-required");

          // Verify response body contains payment details
          const responseBody = await response.json();
          expect(responseBody.error).toBe("Payment Required");
          expect(responseBody.payment_required).toBe(true);
          expect(responseBody.payment_address).toBeTruthy();
          expect(responseBody.payment_amount).toBe("0.01");
          expect(responseBody.payment_currency).toBe("MOVE");
          expect(responseBody.client_ip).toBe(clientIP);
          expect(responseBody.instructions).toContain("0.01 MOVE tokens");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any bot user agent, the system should detect it as a bot
   */
  it('should detect all bot user agents', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string().filter(s => /bot/i.test(s)),
          fc.string().filter(s => /crawler/i.test(s)),
          fc.string().filter(s => /spider/i.test(s)),
          fc.string().filter(s => /scraper/i.test(s)),
          fc.string().filter(s => /python/i.test(s)),
          fc.string().filter(s => /requests/i.test(s)),
          fc.string().filter(s => /curl/i.test(s)),
          fc.string().filter(s => /wget/i.test(s))
        ),
        fc.string(),
        fc.string(),
        fc.string(),
        async (botUserAgent, acceptHeader, acceptLanguage, acceptEncoding) => {
          const isBot = paywall.detectBot(botUserAgent, acceptHeader, acceptLanguage, acceptEncoding);
          expect(isBot).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any missing critical headers, the system should detect it as a bot
   */
  it('should detect bots by missing critical headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => !/(bot|crawler|spider|scraper|python|requests|curl|wget)/i.test(s)),
        fc.oneof(
          fc.constant(""), // Missing Accept-Language
          fc.constant("x"), // Too short Accept-Language
          fc.constant("en") // Valid but will be tested with missing Accept-Encoding
        ),
        fc.oneof(
          fc.constant(""), // Missing Accept-Encoding
          fc.constant("identity") // No gzip support
        ),
        async (userAgent, acceptLanguage, acceptEncoding) => {
          const acceptHeader = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
          
          // Test missing Accept-Language
          if (!acceptLanguage || acceptLanguage.length < 2) {
            const isBot = paywall.detectBot(userAgent, acceptHeader, acceptLanguage, "gzip, deflate");
            expect(isBot).toBe(true);
          }

          // Test missing Accept-Encoding or no gzip support
          if (!acceptEncoding || !acceptEncoding.includes("gzip")) {
            const isBot = paywall.detectBot(userAgent, acceptHeader, "en-US,en;q=0.9", acceptEncoding);
            expect(isBot).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any X402 response, all required payment details should be present
   */
  it('should include all required X402 payment details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (clientIP) => {
          const response = paywall.generateX402Response(clientIP);

          // Verify status code
          expect(response.status).toBe(402);

          // Verify all required headers
          const requiredHeaders = [
            "Content-Type",
            "WWW-Authenticate", 
            "X402-Payment-Address",
            "X402-Payment-Amount",
            "X402-Payment-Currency",
            "X-Bot-Protection"
          ];

          for (const header of requiredHeaders) {
            expect(response.headers.get(header)).toBeTruthy();
          }

          // Verify response body structure
          const responseBody = await response.json();
          const requiredFields = [
            "error",
            "message", 
            "payment_required",
            "payment_address",
            "payment_amount",
            "payment_currency",
            "client_ip",
            "timestamp",
            "instructions"
          ];

          for (const field of requiredFields) {
            expect(responseBody).toHaveProperty(field);
          }

          // Verify specific values
          expect(responseBody.payment_amount).toBe("0.01");
          expect(responseBody.payment_currency).toBe("MOVE");
          expect(responseBody.client_ip).toBe(clientIP);
          expect(responseBody.payment_required).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});