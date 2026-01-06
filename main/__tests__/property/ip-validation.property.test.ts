/**
 * Property-based tests for IP validation
 * **Feature: automated-bot-payment-system, Property 24: IP detection uses consistent method**
 */

import fc from 'fast-check';
import { validateIPAddress } from '../../lib/bot-payment-system/validation';

describe('IP Validation Properties', () => {
  describe('Property 24: IP detection uses consistent method', () => {
    test('valid IPv4 addresses should always pass validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }), // first octet
          fc.integer({ min: 0, max: 255 }), // second octet
          fc.integer({ min: 0, max: 255 }), // third octet
          fc.integer({ min: 0, max: 255 }), // fourth octet
          (a, b, c, d) => {
            const ipAddress = `${a}.${b}.${c}.${d}`;
            const isValid = validateIPAddress(ipAddress);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP addresses with invalid octets should fail validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 256, max: 999 }), // invalid octet (too high)
          fc.integer({ min: 0, max: 255 }), // valid octet
          fc.integer({ min: 0, max: 255 }), // valid octet
          fc.integer({ min: 0, max: 255 }), // valid octet
          (invalidOctet, b, c, d) => {
            const ipAddress = `${invalidOctet}.${b}.${c}.${d}`;
            const isValid = validateIPAddress(ipAddress);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP addresses with negative octets should fail validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -999, max: -1 }), // negative octet
          fc.integer({ min: 0, max: 255 }), // valid octet
          fc.integer({ min: 0, max: 255 }), // valid octet
          fc.integer({ min: 0, max: 255 }), // valid octet
          (negativeOctet, b, c, d) => {
            const ipAddress = `${negativeOctet}.${b}.${c}.${d}`;
            const isValid = validateIPAddress(ipAddress);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('malformed IP strings should fail validation', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)),
          (malformedIP) => {
            const isValid = validateIPAddress(malformedIP);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP addresses with too few octets should fail validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }), // first octet
          fc.integer({ min: 0, max: 255 }), // second octet
          (a, b) => {
            const incompleteIP = `${a}.${b}`;
            const isValid = validateIPAddress(incompleteIP);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP addresses with too many octets should fail validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }), // first octet
          fc.integer({ min: 0, max: 255 }), // second octet
          fc.integer({ min: 0, max: 255 }), // third octet
          fc.integer({ min: 0, max: 255 }), // fourth octet
          fc.integer({ min: 0, max: 255 }), // fifth octet (too many)
          (a, b, c, d, e) => {
            const tooManyOctetsIP = `${a}.${b}.${c}.${d}.${e}`;
            const isValid = validateIPAddress(tooManyOctetsIP);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('specific known valid IP addresses should pass validation', () => {
      const knownValidIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '8.8.8.8',
        '1.1.1.1',
        '127.0.0.1',
        '0.0.0.0',
        '255.255.255.255'
      ];

      knownValidIPs.forEach(ip => {
        const isValid = validateIPAddress(ip);
        expect(isValid).toBe(true);
      });
    });

    test('specific known invalid IP addresses should fail validation', () => {
      const knownInvalidIPs = [
        '256.1.1.1',
        '1.256.1.1',
        '1.1.256.1',
        '1.1.1.256',
        '192.168.1',
        '192.168.1.1.1',
        'not.an.ip.address',
        '192.168.-1.1',
        '',
        '...',
        'localhost'
      ];

      knownInvalidIPs.forEach(ip => {
        const isValid = validateIPAddress(ip);
        expect(isValid).toBe(false);
      });
    });
  });
});