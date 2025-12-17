/**
 * Property-Based Tests for Gatekeeper WAF Rule Expression
 * Feature: gatekeeper-bot-firewall, Property 8 & 9: WAF Rule Expression Correctness
 * Validates: Requirements 4.3, 4.4, 8.2, 8.3, 8.4, 8.5
 */

import fc from 'fast-check';

/**
 * Mock request for testing
 */
interface MockRequest {
  cf_client_bot: boolean;
  user_agent: string;
  x_bot_password_header: string | null;
}

/**
 * Evaluate WAF rule expression
 * Returns true if challenge should be triggered, false if request should pass through
 */
function evaluateWAFExpression(request: MockRequest, secretKey: string): boolean {
  // Check if request is identified as bot
  const isBotDetected =
    request.cf_client_bot ||
    request.user_agent.toLowerCase().includes('curl') ||
    request.user_agent.toLowerCase().includes('python') ||
    request.user_agent.toLowerCase().includes('bot');

  // If not a bot, allow through
  if (!isBotDetected) {
    return false;
  }

  // If bot detected, check password
  const passwordMatches = request.x_bot_password_header === secretKey;

  // If password matches, allow through (return false = no challenge)
  // If password doesn't match, trigger challenge (return true = challenge)
  return !passwordMatches;
}

describe('WAF Rule Expression Properties', () => {
  /**
   * Property 8: WAF Rule Expression Correctness for Valid Password
   * For any request with the x-bot-password header value matching the project's secret_key,
   * the WAF rule expression SHALL evaluate to false, allowing the request through without managed_challenge.
   */
  test('Property 8: Valid password allows request through', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 40, maxLength: 40 }),
          fc.constantFrom('curl', 'python', 'bot', 'Mozilla/5.0')
        ),
        ([secretKey, userAgent]) => {
          const request: MockRequest = {
            cf_client_bot: true,
            user_agent: userAgent,
            x_bot_password_header: secretKey,
          };

          const shouldChallenge = evaluateWAFExpression(request, secretKey);

          // With valid password, should NOT challenge (return false)
          expect(shouldChallenge).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: WAF Rule Expression Correctness for Invalid Password
   * For any request identified as a bot without the x-bot-password header or with an incorrect header value,
   * the WAF rule expression SHALL evaluate to true, triggering a managed_challenge action.
   */
  test('Property 9: Invalid password triggers challenge', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 40, maxLength: 40 }),
          fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s !== 'gk_live_' + 'a'.repeat(32))
        ),
        ([secretKey, wrongPassword]) => {
          const request: MockRequest = {
            cf_client_bot: true,
            user_agent: 'curl/7.0',
            x_bot_password_header: wrongPassword,
          };

          const shouldChallenge = evaluateWAFExpression(request, secretKey);

          // With invalid password, SHOULD challenge (return true)
          expect(shouldChallenge).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Missing password header triggers challenge for bots
   */
  test('Property: Missing password header triggers challenge for bots', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 40, maxLength: 40 }),
        (secretKey) => {
          const request: MockRequest = {
            cf_client_bot: true,
            user_agent: 'python-requests/2.0',
            x_bot_password_header: null,
          };

          const shouldChallenge = evaluateWAFExpression(request, secretKey);

          // Missing password should trigger challenge
          expect(shouldChallenge).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-bot requests are never challenged
   */
  test('Property: Non-bot requests are never challenged', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 40, maxLength: 40 }),
          fc.string({ minLength: 1, maxLength: 100 })
        ),
        ([secretKey, userAgent]) => {
          const request: MockRequest = {
            cf_client_bot: false,
            user_agent: userAgent,
            x_bot_password_header: null,
          };

          const shouldChallenge = evaluateWAFExpression(request, secretKey);

          // Non-bot requests should never be challenged
          expect(shouldChallenge).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bot detection works for various user agents
   */
  test('Property: Bot detection works for various user agents', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 40, maxLength: 40 }),
        (secretKey) => {
          const botUserAgents = [
            'curl/7.0',
            'python-requests/2.0',
            'Mozilla/5.0 (compatible; Googlebot/2.1)',
            'python-urllib/3.0',
            'curl',
            'bot',
          ];

          botUserAgents.forEach((userAgent) => {
            const request: MockRequest = {
              cf_client_bot: false, // Not flagged by cf.client.bot
              user_agent: userAgent,
              x_bot_password_header: null,
            };

            const shouldChallenge = evaluateWAFExpression(request, secretKey);

            // Should be detected as bot by user agent
            expect(shouldChallenge).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Exact password match is required
   */
  test('Property: Exact password match is required', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 40, maxLength: 40 }).filter((s) => !s.includes('X')),
          fc.integer({ min: 0, max: 39 })
        ),
        ([secretKey, charIndex]) => {
          // Create a password that's almost correct but differs by one character
          const wrongPassword = secretKey.substring(0, charIndex) + 'X' + secretKey.substring(charIndex + 1);

          // Only test if the password is actually different
          if (wrongPassword === secretKey) {
            return;
          }

          const request: MockRequest = {
            cf_client_bot: true,
            user_agent: 'curl/7.0',
            x_bot_password_header: wrongPassword,
          };

          const shouldChallenge = evaluateWAFExpression(request, secretKey);

          // Even one character difference should trigger challenge
          expect(shouldChallenge).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Case sensitivity in password matching
   */
  test('Property: Password matching is case sensitive', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 40, maxLength: 40 }),
        (secretKey) => {
          // Try uppercase version
          const uppercasePassword = secretKey.toUpperCase();

          const request: MockRequest = {
            cf_client_bot: true,
            user_agent: 'curl/7.0',
            x_bot_password_header: uppercasePassword,
          };

          const shouldChallenge = evaluateWAFExpression(request, secretKey);

          // Case difference should trigger challenge
          if (secretKey !== uppercasePassword) {
            expect(shouldChallenge).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
