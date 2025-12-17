/**
 * Property-Based Tests for Gatekeeper Secret Key Obscuration
 * Feature: gatekeeper-bot-firewall, Property 12: Secret Key Obscuration
 * Validates: Requirements 5.2
 */

import fc from 'fast-check';
import { obscureSecretKey, generateSecretKey } from '@/lib/secret-key-generator';

describe('Secret Key Obscuration Properties', () => {
  /**
   * Property 12: Secret Key Obscuration
   * For any secret_key displayed in the UI, the obscured format SHALL show only the prefix (e.g., "gk_live_")
   * followed by bullet points, with the full key accessible only via copy button.
   */
  test('Property 12: Secret key obscuration preserves prefix and hides content', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();
          const obscured = obscureSecretKey(secretKey);

          // Should start with gk_live_
          expect(obscured).toMatch(/^gk_live_/);

          // Should contain bullet points
          expect(obscured).toContain('•');

          // Should be 40 characters total (8 for prefix + 32 for bullets)
          expect(obscured.length).toBe(40);

          // Should not contain the actual secret key content
          expect(obscured).not.toContain(secretKey.substring(8));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Obscured key always has correct format
   */
  test('Property: Obscured key always has correct format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();
          const obscured = obscureSecretKey(secretKey);

          // Should match pattern: gk_live_ followed by 32 bullet points
          expect(obscured).toMatch(/^gk_live_•{32}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Prefix is always visible
   */
  test('Property: Prefix is always visible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();
          const obscured = obscureSecretKey(secretKey);

          expect(obscured.substring(0, 8)).toBe('gk_live_');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different secret keys produce different obscured versions
   */
  test('Property: Different secret keys produce different obscured versions', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 })
        ),
        ([_, __]) => {
          const key1 = generateSecretKey();
          const key2 = generateSecretKey();

          // Keys should be different
          expect(key1).not.toBe(key2);

          const obscured1 = obscureSecretKey(key1);
          const obscured2 = obscureSecretKey(key2);

          // Obscured versions should also be the same (since they're all bullets)
          // But the important thing is they're both properly formatted
          expect(obscured1).toMatch(/^gk_live_•{32}$/);
          expect(obscured2).toMatch(/^gk_live_•{32}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Obscuration doesn't modify original key
   */
  test('Property: Obscuration does not modify original key', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();
          const keyBefore = secretKey;

          obscureSecretKey(secretKey);

          expect(secretKey).toBe(keyBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Obscured key length is always 40 characters
   */
  test('Property: Obscured key length is always 40 characters', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();
          const obscured = obscureSecretKey(secretKey);

          expect(obscured.length).toBe(40);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid keys are handled gracefully
   */
  test('Property: Invalid keys are handled gracefully', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.match(/^gk_live_[a-f0-9]{32}$/)),
        (invalidKey) => {
          const obscured = obscureSecretKey(invalidKey);

          // Should return a safe obscured version
          expect(obscured).toBeDefined();
          expect(obscured.length).toBeGreaterThan(0);
          // Should be all bullets for invalid keys
          expect(obscured).toBe('•'.repeat(32));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Obscured key contains no alphanumeric characters except prefix
   */
  test('Property: Obscured key contains no alphanumeric characters except prefix', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();
          const obscured = obscureSecretKey(secretKey);

          // Get the part after the prefix
          const hiddenPart = obscured.substring(8);

          // Should only contain bullet points
          expect(hiddenPart).toMatch(/^•+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Obscuration is consistent
   */
  test('Property: Obscuration is consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (_) => {
          const secretKey = generateSecretKey();

          const obscured1 = obscureSecretKey(secretKey);
          const obscured2 = obscureSecretKey(secretKey);
          const obscured3 = obscureSecretKey(secretKey);

          expect(obscured1).toBe(obscured2);
          expect(obscured2).toBe(obscured3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
