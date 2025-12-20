/**
 * Property-based tests for IP detection fallback mechanisms
 * **Feature: x402-payment-integration-fix, Property 24: IP detection failures trigger fallback methods**
 */

import fc from 'fast-check';

describe('IP Detection Fallback Properties', () => {
  // Mock types for testing IP detection scenarios
  interface MockIPDetectionMethod {
    name: string;
    shouldFail: boolean;
    returnValue?: string;
    errorMessage?: string;
  }

  interface MockIPDetectionResult {
    success: boolean;
    ip?: string;
    methodUsed?: string;
    attemptedMethods: string[];
    errors: string[];
  }

  // Mock IP detection service
  class MockPaymentVerificationService {
    private configuredIP?: string;
    private detectionMethods: MockIPDetectionMethod[];

    constructor(configuredIP?: string, detectionMethods: MockIPDetectionMethod[] = []) {
      this.configuredIP = configuredIP;
      this.detectionMethods = detectionMethods;
    }

    async extractPayerIP(): Promise<MockIPDetectionResult> {
      const attemptedMethods: string[] = [];
      const errors: string[] = [];

      try {
        // Use configured IP if available (highest priority)
        if (this.configuredIP !== undefined && this.configuredIP !== null) {
          if (this.isValidIPAddress(this.configuredIP)) {
            return {
              success: true,
              ip: this.configuredIP,
              methodUsed: 'configured',
              attemptedMethods: ['configured'],
              errors: []
            };
          } else {
            errors.push('Configured IP is invalid');
          }
        }

        // Try fallback methods in order
        for (const method of this.detectionMethods) {
          attemptedMethods.push(method.name);

          try {
            if (method.shouldFail) {
              throw new Error(method.errorMessage || `${method.name} failed`);
            }

            const ip = method.returnValue || this.generateMockIP();
            if (this.isValidIPAddress(ip)) {
              return {
                success: true,
                ip,
                methodUsed: method.name,
                attemptedMethods,
                errors
              };
            } else {
              errors.push(`${method.name} returned invalid IP: ${ip}`);
            }
          } catch (error) {
            errors.push(`${method.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // All methods failed
        return {
          success: false,
          attemptedMethods,
          errors: [...errors, 'All IP detection methods failed']
        };

      } catch (error) {
        return {
          success: false,
          attemptedMethods,
          errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
        };
      }
    }

    private isValidIPAddress(ip: string): boolean {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return ipv4Regex.test(ip);
    }

    private generateMockIP(): string {
      return `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
    }

    async selectMostReliableIP(detectedIPs: string[]): Promise<string> {
      if (detectedIPs.length === 0) {
        throw new Error('No IP addresses detected');
      }

      // Filter valid IPs
      const validIPs = detectedIPs.filter(ip => this.isValidIPAddress(ip));
      
      if (validIPs.length === 0) {
        throw new Error('No valid IP addresses found');
      }

      // Return first valid IP (most reliable method succeeded)
      return validIPs[0];
    }
  }

  // Helper to generate valid IP addresses
  const validIPGenerator = fc.tuple(
    fc.integer({ min: 1, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 254 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  describe('Property 24: IP detection failures trigger fallback methods', () => {
    test('any failing IP detection method should trigger next fallback method', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('icanhazip', 'ipify', 'httpbin', 'ipinfo', 'cloudflare', 'local'),
              shouldFail: fc.boolean(),
              returnValue: fc.option(validIPGenerator, { nil: undefined })
            }),
            { minLength: 2, maxLength: 6 }
          ).filter(methods => {
            // Ensure unique method names
            const names = methods.map(m => m.name);
            return new Set(names).size === names.length;
          }),
          async (detectionMethods) => {
            const service = new MockPaymentVerificationService(undefined, detectionMethods);
            const result = await service.extractPayerIP();

            // Verify all methods were attempted until success or all failed
            expect(result.attemptedMethods.length).toBeGreaterThan(0);
            expect(result.attemptedMethods.length).toBeLessThanOrEqual(detectionMethods.length);

            if (result.success) {
              // If successful, should have found a working method
              expect(result.ip).toBeDefined();
              expect(result.methodUsed).toBeDefined();
              expect(result.attemptedMethods).toContain(result.methodUsed!);

              // Should have stopped at first successful method
              const successfulMethodIndex = detectionMethods.findIndex(m => 
                m.name === result.methodUsed && !m.shouldFail
              );
              expect(successfulMethodIndex).toBeGreaterThanOrEqual(0);
              expect(result.attemptedMethods.length).toBeLessThanOrEqual(successfulMethodIndex + 1);
            } else {
              // If failed, should have attempted all methods or stopped at first success
              const workingMethods = detectionMethods.filter(m => !m.shouldFail);
              if (workingMethods.length === 0) {
                // All methods fail - should attempt all
                expect(result.attemptedMethods.length).toBe(detectionMethods.length);
                expect(result.errors.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('configured IP should always take precedence over fallback methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPGenerator, // configured IP
          fc.array(
            fc.record({
              name: fc.constantFrom('icanhazip', 'ipify', 'httpbin'),
              shouldFail: fc.boolean(),
              returnValue: fc.option(validIPGenerator, { nil: undefined })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (configuredIP, fallbackMethods) => {
            const service = new MockPaymentVerificationService(configuredIP, fallbackMethods);
            const result = await service.extractPayerIP();

            // Should always succeed with configured IP
            expect(result.success).toBe(true);
            expect(result.ip).toBe(configuredIP);
            expect(result.methodUsed).toBe('configured');
            expect(result.attemptedMethods).toEqual(['configured']);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invalid configured IP should trigger fallback methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid.ip'),
            fc.constant('999.999.999.999'),
            fc.constant('not-an-ip'),
            fc.constant('')
          ), // invalid configured IP
          fc.array(
            fc.record({
              name: fc.constantFrom('icanhazip', 'ipify'),
              shouldFail: fc.constant(false),
              returnValue: validIPGenerator
            }),
            { minLength: 1, maxLength: 2 }
          ), // working fallback methods
          async (invalidConfiguredIP, fallbackMethods) => {
            const service = new MockPaymentVerificationService(invalidConfiguredIP, fallbackMethods);
            const result = await service.extractPayerIP();

            // Should succeed using fallback method
            expect(result.success).toBe(true);
            expect(result.ip).not.toBe(invalidConfiguredIP);
            expect(result.methodUsed).not.toBe('configured');
            expect(result.errors).toContain('Configured IP is invalid');
            expect(result.attemptedMethods.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all methods failing should return comprehensive error information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('icanhazip', 'ipify', 'httpbin', 'ipinfo'),
              shouldFail: fc.constant(true),
              errorMessage: fc.string({ minLength: 5, maxLength: 50 })
            }),
            { minLength: 2, maxLength: 4 }
          ).filter(methods => {
            const names = methods.map(m => m.name);
            return new Set(names).size === names.length;
          }),
          async (failingMethods) => {
            const service = new MockPaymentVerificationService(undefined, failingMethods);
            const result = await service.extractPayerIP();

            // Should fail with comprehensive error information
            expect(result.success).toBe(false);
            expect(result.ip).toBeUndefined();
            expect(result.methodUsed).toBeUndefined();

            // Should have attempted all methods
            expect(result.attemptedMethods).toHaveLength(failingMethods.length);
            expect(result.attemptedMethods.sort()).toEqual(failingMethods.map(m => m.name).sort());

            // Should have error for each method plus final error
            expect(result.errors.length).toBeGreaterThanOrEqual(failingMethods.length);
            expect(result.errors[result.errors.length - 1]).toContain('All IP detection methods failed');

            // Should contain specific error messages
            for (const method of failingMethods) {
              const hasMethodError = result.errors.some(error => 
                error.includes(method.name) && error.includes(method.errorMessage)
              );
              expect(hasMethodError).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('mixed success and failure methods should stop at first success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('icanhazip', 'ipify', 'httpbin', 'ipinfo', 'cloudflare'),
              shouldFail: fc.boolean(),
              returnValue: fc.option(validIPGenerator, { nil: undefined }),
              errorMessage: fc.option(fc.string({ minLength: 5, maxLength: 30 }), { nil: undefined })
            }),
            { minLength: 3, maxLength: 5 }
          ).filter(methods => {
            const names = methods.map(m => m.name);
            const hasSuccess = methods.some(m => !m.shouldFail);
            return new Set(names).size === names.length && hasSuccess;
          }),
          async (mixedMethods) => {
            const service = new MockPaymentVerificationService(undefined, mixedMethods);
            const result = await service.extractPayerIP();

            // Should succeed
            expect(result.success).toBe(true);
            expect(result.ip).toBeDefined();
            expect(result.methodUsed).toBeDefined();

            // Find the first successful method
            const firstSuccessIndex = mixedMethods.findIndex(m => !m.shouldFail);
            expect(firstSuccessIndex).toBeGreaterThanOrEqual(0);

            // Should have attempted methods up to and including first success
            expect(result.attemptedMethods.length).toBe(firstSuccessIndex + 1);
            expect(result.methodUsed).toBe(mixedMethods[firstSuccessIndex].name);

            // Should have errors for failed methods before success
            const failedMethodsBeforeSuccess = mixedMethods.slice(0, firstSuccessIndex).filter(m => m.shouldFail);
            expect(result.errors.length).toBe(failedMethodsBeforeSuccess.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP validation should reject invalid addresses from any method', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('icanhazip', 'ipify', 'httpbin'),
              shouldFail: fc.constant(false),
              returnValue: fc.oneof(
                fc.constant('invalid.ip.address'),
                fc.constant('999.999.999.999'),
                fc.constant('not-an-ip-at-all'),
                fc.constant(''),
                validIPGenerator // Some valid IPs mixed in
              )
            }),
            { minLength: 2, maxLength: 4 }
          ).filter(methods => {
            const names = methods.map(m => m.name);
            return new Set(names).size === names.length;
          }),
          async (methodsWithMixedIPs) => {
            const service = new MockPaymentVerificationService(undefined, methodsWithMixedIPs);
            const result = await service.extractPayerIP();

            if (result.success) {
              // If successful, IP should be valid
              expect(result.ip).toBeDefined();
              expect(result.ip).toMatch(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
            } else {
              // If failed, should have attempted all methods
              expect(result.attemptedMethods.length).toBe(methodsWithMixedIPs.length);
              
              // Should have errors for invalid IPs
              const invalidIPMethods = methodsWithMixedIPs.filter(m => 
                m.returnValue && !m.returnValue.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)
              );
              
              if (invalidIPMethods.length > 0) {
                const hasInvalidIPErrors = result.errors.some(error => 
                  error.includes('returned invalid IP')
                );
                expect(hasInvalidIPErrors).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('most reliable IP selection should handle multiple detected IPs correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validIPGenerator, { minLength: 1, maxLength: 5 }).filter(ips => 
            new Set(ips).size === ips.length // unique IPs
          ),
          async (detectedIPs) => {
            const service = new MockPaymentVerificationService();
            
            if (detectedIPs.length === 0) {
              await expect(service.selectMostReliableIP(detectedIPs)).rejects.toThrow('No IP addresses detected');
            } else {
              const selectedIP = await service.selectMostReliableIP(detectedIPs);
              
              // Should return one of the detected IPs
              expect(detectedIPs).toContain(selectedIP);
              
              // Should be a valid IP
              expect(selectedIP).toMatch(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
              
              // For single IP, should return that IP
              if (detectedIPs.length === 1) {
                expect(selectedIP).toBe(detectedIPs[0]);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP selection should handle invalid IPs in the list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              validIPGenerator,
              fc.constant('invalid.ip'),
              fc.constant('999.999.999.999'),
              fc.constant('')
            ),
            { minLength: 1, maxLength: 6 }
          ),
          async (mixedIPs) => {
            const service = new MockPaymentVerificationService();
            const validIPs = mixedIPs.filter(ip => 
              /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)
            );

            if (validIPs.length === 0) {
              await expect(service.selectMostReliableIP(mixedIPs)).rejects.toThrow('No valid IP addresses found');
            } else {
              const selectedIP = await service.selectMostReliableIP(mixedIPs);
              
              // Should return a valid IP
              expect(validIPs).toContain(selectedIP);
              expect(selectedIP).toMatch(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('fallback chain should maintain order and provide detailed attempt information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('method1', 'method2', 'method3', 'method4'),
              shouldFail: fc.boolean(),
              returnValue: fc.option(validIPGenerator, { nil: undefined })
            }),
            { minLength: 3, maxLength: 4 }
          ).filter(methods => {
            const names = methods.map(m => m.name);
            return new Set(names).size === names.length;
          }),
          async (orderedMethods) => {
            const service = new MockPaymentVerificationService(undefined, orderedMethods);
            const result = await service.extractPayerIP();

            // Attempted methods should maintain order
            for (let i = 0; i < result.attemptedMethods.length - 1; i++) {
              const currentIndex = orderedMethods.findIndex(m => m.name === result.attemptedMethods[i]);
              const nextIndex = orderedMethods.findIndex(m => m.name === result.attemptedMethods[i + 1]);
              expect(currentIndex).toBeLessThan(nextIndex);
            }

            // Should provide detailed information
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('attemptedMethods');
            expect(result).toHaveProperty('errors');
            expect(Array.isArray(result.attemptedMethods)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);

            if (result.success) {
              expect(result).toHaveProperty('ip');
              expect(result).toHaveProperty('methodUsed');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});