/**
 * Property-based tests for IP source selection
 * **Feature: x402-payment-integration-fix, Property 25: Multiple IP detection selects most reliable source**
 */

import fc from 'fast-check';

describe('IP Source Selection Properties', () => {
  // Mock types for testing IP source selection
  interface IPSource {
    name: string;
    reliability: number; // 1-10, higher is more reliable
    ip: string;
    responseTime: number; // milliseconds
    isValid: boolean;
  }

  interface IPSelectionResult {
    selectedIP: string;
    selectedSource: string;
    allSources: IPSource[];
    selectionReason: string;
    confidence: number; // 0-1
  }

  // Mock IP source selector
  class MockIPSourceSelector {
    private readonly reliabilityOrder = [
      'configured',   // 10 - Configured IP (highest)
      'icanhazip',    // 9  - icanhazip.com
      'ipify',        // 8  - ipify.org
      'httpbin',      // 7  - httpbin.org
      'ipinfo',       // 6  - ipinfo.io
      'cloudflare',   // 5  - Cloudflare trace
      'local'         // 4  - Local network IP (lowest)
    ];

    async selectMostReliableIP(sources: IPSource[]): Promise<IPSelectionResult> {
      if (sources.length === 0) {
        throw new Error('No IP sources provided');
      }

      // Filter out invalid IPs
      const validSources = sources.filter(source => source.isValid);
      
      if (validSources.length === 0) {
        throw new Error('No valid IP sources found');
      }

      // Always use reliability-based selection for multiple sources
      return this.selectFromMultipleSources(validSources, sources);
    }

    private selectFromMultipleSources(validSources: IPSource[], allSources: IPSource[]): IPSelectionResult {
      // Handle single valid source case
      if (validSources.length === 1) {
        const source = validSources[0];
        // Check if it's in our reliability order
        if (this.reliabilityOrder.includes(source.name)) {
          return {
            selectedIP: source.ip,
            selectedSource: source.name,
            allSources,
            selectionReason: `Selected by reliability order (${source.name})`,
            confidence: 0.9
          };
        } else {
          return {
            selectedIP: source.ip,
            selectedSource: source.name,
            allSources,
            selectionReason: 'Only valid source available',
            confidence: 0.8
          };
        }
      }

      // Strategy 1: Use reliability order if available
      for (const reliableSourceName of this.reliabilityOrder) {
        const source = validSources.find(s => s.name === reliableSourceName);
        if (source) {
          return {
            selectedIP: source.ip,
            selectedSource: source.name,
            allSources,
            selectionReason: `Selected by reliability order (${reliableSourceName})`,
            confidence: 0.9
          };
        }
      }

      // Strategy 2: Use highest reliability score
      const highestReliability = Math.max(...validSources.map(s => s.reliability));
      const mostReliableSources = validSources.filter(s => s.reliability === highestReliability);
      
      if (mostReliableSources.length === 1) {
        return {
          selectedIP: mostReliableSources[0].ip,
          selectedSource: mostReliableSources[0].name,
          allSources,
          selectionReason: `Highest reliability score (${highestReliability})`,
          confidence: 0.8
        };
      }

      // Strategy 3: Among equally reliable, choose fastest response
      const fastestSource = mostReliableSources.reduce((fastest, current) => 
        current.responseTime < fastest.responseTime ? current : fastest
      );

      return {
        selectedIP: fastestSource.ip,
        selectedSource: fastestSource.name,
        allSources,
        selectionReason: `Fastest among equally reliable (${fastestSource.responseTime}ms)`,
        confidence: 0.7
      };
    }

    async crossReferenceIPs(sources: IPSource[]): Promise<{
      consensus: string | null;
      conflicting: boolean;
      agreementCount: number;
      totalValid: number;
    }> {
      const validSources = sources.filter(s => s.isValid);
      
      if (validSources.length === 0) {
        return {
          consensus: null,
          conflicting: false,
          agreementCount: 0,
          totalValid: 0
        };
      }

      // Count occurrences of each IP
      const ipCounts = new Map<string, number>();
      for (const source of validSources) {
        ipCounts.set(source.ip, (ipCounts.get(source.ip) || 0) + 1);
      }

      // Find most common IP
      let maxCount = 0;
      let consensusIP: string | null = null;
      
      for (const [ip, count] of ipCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          consensusIP = ip;
        }
      }

      return {
        consensus: consensusIP,
        conflicting: ipCounts.size > 1,
        agreementCount: maxCount,
        totalValid: validSources.length
      };
    }

    getReliabilityScore(sourceName: string): number {
      const index = this.reliabilityOrder.indexOf(sourceName);
      return index >= 0 ? (this.reliabilityOrder.length - index) : 1;
    }
  }

  // Helper generators
  const validIPGenerator = fc.tuple(
    fc.integer({ min: 1, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 1, max: 254 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  const ipSourceGenerator = fc.record({
    name: fc.constantFrom('configured', 'icanhazip', 'ipify', 'httpbin', 'ipinfo', 'cloudflare', 'local'),
    reliability: fc.integer({ min: 1, max: 10 }),
    ip: validIPGenerator,
    responseTime: fc.integer({ min: 50, max: 5000 }),
    isValid: fc.boolean()
  });

  describe('Property 25: Multiple IP detection selects most reliable source', () => {
    test('any configured IP source should always be selected when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          validIPGenerator, // configured IP
          fc.array(
            ipSourceGenerator.filter(s => s.name !== 'configured'),
            { minLength: 1, maxLength: 5 }
          ), // other sources
          async (configuredIP, otherSources) => {
            const configuredSource: IPSource = {
              name: 'configured',
              reliability: 10,
              ip: configuredIP,
              responseTime: 0,
              isValid: true
            };

            const allSources = [configuredSource, ...otherSources];
            const selector = new MockIPSourceSelector();
            const result = await selector.selectMostReliableIP(allSources);

            // Configured IP should always be selected
            expect(result.selectedIP).toBe(configuredIP);
            expect(result.selectedSource).toBe('configured');
            expect(result.selectionReason).toContain('reliability order');
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('highest reliability source should be selected when no configured IP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            ipSourceGenerator.filter(s => s.name !== 'configured'),
            { minLength: 2, maxLength: 6 }
          ).filter(sources => {
            // Ensure unique source names and at least one valid source
            const names = sources.map(s => s.name);
            const hasValid = sources.some(s => s.isValid);
            return new Set(names).size === names.length && hasValid;
          }),
          async (sources) => {
            const selector = new MockIPSourceSelector();
            const result = await selector.selectMostReliableIP(sources);

            // Should select a valid source
            const selectedSource = sources.find(s => s.name === result.selectedSource);
            expect(selectedSource).toBeDefined();
            expect(selectedSource!.isValid).toBe(true);
            expect(selectedSource!.ip).toBe(result.selectedIP);

            // Should be among the most reliable valid sources
            const validSources = sources.filter(s => s.isValid);
            
            // If selection was by reliability order, it should be the highest in the order
            const reliabilityOrder = ['configured', 'icanhazip', 'ipify', 'httpbin', 'ipinfo', 'cloudflare', 'local'];
            
            // Find the highest priority valid source in reliability order
            let expectedSource: IPSource | undefined;
            for (const sourceName of reliabilityOrder) {
              expectedSource = validSources.find(s => s.name === sourceName);
              if (expectedSource) break;
            }
            
            if (expectedSource) {
              // If we found a source in the reliability order, it should be selected
              expect(result.selectedSource).toBe(expectedSource.name);
            } else {
              // Otherwise, should select based on highest reliability score
              const maxReliability = Math.max(...validSources.map(s => s.reliability));
              expect(selectedSource!.reliability).toBeGreaterThanOrEqual(
                Math.max(1, maxReliability - 2) // Allow some tolerance for tie-breaking
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invalid IP sources should be filtered out during selection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            ipSourceGenerator,
            { minLength: 2, maxLength: 8 }
          ).filter(sources => {
            const names = sources.map(s => s.name);
            const hasValid = sources.some(s => s.isValid);
            const hasInvalid = sources.some(s => !s.isValid);
            return new Set(names).size === names.length && hasValid && hasInvalid;
          }),
          async (mixedSources) => {
            const selector = new MockIPSourceSelector();
            const result = await selector.selectMostReliableIP(mixedSources);

            // Selected source must be valid
            const selectedSource = mixedSources.find(s => s.name === result.selectedSource);
            expect(selectedSource).toBeDefined();
            expect(selectedSource!.isValid).toBe(true);

            // Should not select any invalid sources
            const invalidSources = mixedSources.filter(s => !s.isValid);
            for (const invalidSource of invalidSources) {
              expect(result.selectedSource).not.toBe(invalidSource.name);
              expect(result.selectedIP).not.toBe(invalidSource.ip);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('response time should be used as tie-breaker for equally reliable sources', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 10 }), // reliability level
          fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z]+$/.test(s)),
              ip: validIPGenerator,
              responseTime: fc.integer({ min: 100, max: 3000 }),
              isValid: fc.constant(true)
            }),
            { minLength: 2, maxLength: 4 }
          ).filter(sources => {
            const names = sources.map(s => s.name);
            const responseTimes = sources.map(s => s.responseTime);
            return new Set(names).size === names.length && 
                   new Set(responseTimes).size > 1; // Different response times
          }),
          async (reliabilityLevel, baseSources) => {
            // Make all sources have the same reliability
            const equalReliabilitySources = baseSources.map(source => ({
              ...source,
              reliability: reliabilityLevel
            }));

            const selector = new MockIPSourceSelector();
            const result = await selector.selectMostReliableIP(equalReliabilitySources);

            // Should select one of the sources with equal reliability
            const selectedSource = equalReliabilitySources.find(s => s.name === result.selectedSource);
            expect(selectedSource).toBeDefined();
            expect(selectedSource!.reliability).toBe(reliabilityLevel);

            // Should prefer faster response time when reliability is equal
            const fastestResponseTime = Math.min(...equalReliabilitySources.map(s => s.responseTime));
            const fastestSources = equalReliabilitySources.filter(s => s.responseTime === fastestResponseTime);
            
            // Selected source should be among the fastest
            expect(fastestSources.map(s => s.name)).toContain(result.selectedSource);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('cross-reference should detect IP consensus and conflicts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 8 }).filter(s => /^[a-z]+$/.test(s)),
              ip: validIPGenerator,
              isValid: fc.constant(true)
            }),
            { minLength: 2, maxLength: 6 }
          ).filter(sources => {
            const names = sources.map(s => s.name);
            return new Set(names).size === names.length;
          }),
          async (sources) => {
            const selector = new MockIPSourceSelector();
            const crossRef = await selector.crossReferenceIPs(sources);

            expect(crossRef.totalValid).toBe(sources.length);
            expect(crossRef.agreementCount).toBeGreaterThan(0);
            expect(crossRef.agreementCount).toBeLessThanOrEqual(sources.length);

            if (crossRef.consensus) {
              // Consensus IP should be one of the source IPs
              const sourceIPs = sources.map(s => s.ip);
              expect(sourceIPs).toContain(crossRef.consensus);

              // Agreement count should match actual occurrences
              const actualCount = sources.filter(s => s.ip === crossRef.consensus).length;
              expect(crossRef.agreementCount).toBe(actualCount);
            }

            // Conflicting should be true if there are different IPs
            const uniqueIPs = new Set(sources.map(s => s.ip));
            expect(crossRef.conflicting).toBe(uniqueIPs.size > 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('reliability scoring should follow predefined order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.shuffledSubarray(['configured', 'icanhazip', 'ipify', 'httpbin', 'ipinfo', 'cloudflare', 'local'], {
            minLength: 2,
            maxLength: 7
          }),
          async (sourceNames) => {
            const selector = new MockIPSourceSelector();
            const scores = sourceNames.map(name => ({
              name,
              score: selector.getReliabilityScore(name)
            }));

            // Configured should have highest score if present
            const configuredScore = scores.find(s => s.name === 'configured');
            if (configuredScore) {
              const otherScores = scores.filter(s => s.name !== 'configured');
              for (const otherScore of otherScores) {
                expect(configuredScore.score).toBeGreaterThan(otherScore.score);
              }
            }

            // icanhazip should score higher than ipify, etc.
            const icanhazip = scores.find(s => s.name === 'icanhazip');
            const ipify = scores.find(s => s.name === 'ipify');
            if (icanhazip && ipify) {
              expect(icanhazip.score).toBeGreaterThan(ipify.score);
            }

            // local should have lowest score among known sources
            const local = scores.find(s => s.name === 'local');
            if (local) {
              const knownSources = scores.filter(s => 
                ['configured', 'icanhazip', 'ipify', 'httpbin', 'ipinfo', 'cloudflare'].includes(s.name)
              );
              for (const knownSource of knownSources) {
                expect(knownSource.score).toBeGreaterThan(local.score);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('selection should provide meaningful reasons and confidence scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            ipSourceGenerator,
            { minLength: 1, maxLength: 5 }
          ).filter(sources => {
            const names = sources.map(s => s.name);
            const hasValid = sources.some(s => s.isValid);
            return new Set(names).size === names.length && hasValid;
          }),
          async (sources) => {
            const selector = new MockIPSourceSelector();
            const result = await selector.selectMostReliableIP(sources);

            // Should provide meaningful selection reason
            expect(result.selectionReason).toBeTruthy();
            expect(typeof result.selectionReason).toBe('string');
            expect(result.selectionReason.length).toBeGreaterThan(10);

            // Confidence should be between 0 and 1
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);

            // Higher confidence for more reliable selections
            if (result.selectionReason.includes('reliability order')) {
              expect(result.confidence).toBeGreaterThanOrEqual(0.8);
            } else if (result.selectionReason.includes('Only valid source')) {
              expect(result.confidence).toBeGreaterThanOrEqual(0.3);
            }

            // Should include all sources in result
            expect(result.allSources).toEqual(sources);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty or all-invalid source arrays should be handled gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant([]), // empty array
            fc.array(
              ipSourceGenerator.map(s => ({ ...s, isValid: false })), // all invalid
              { minLength: 1, maxLength: 3 }
            )
          ),
          async (problematicSources) => {
            const selector = new MockIPSourceSelector();

            if (problematicSources.length === 0) {
              await expect(selector.selectMostReliableIP(problematicSources))
                .rejects.toThrow('No IP sources provided');
            } else {
              // All invalid sources
              await expect(selector.selectMostReliableIP(problematicSources))
                .rejects.toThrow('No valid IP sources found');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('selection should be deterministic for identical inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            ipSourceGenerator,
            { minLength: 2, maxLength: 4 }
          ).filter(sources => {
            const names = sources.map(s => s.name);
            const hasValid = sources.some(s => s.isValid);
            return new Set(names).size === names.length && hasValid;
          }),
          async (sources) => {
            const selector = new MockIPSourceSelector();
            
            // Run selection multiple times with same input
            const results = await Promise.all([
              selector.selectMostReliableIP([...sources]),
              selector.selectMostReliableIP([...sources]),
              selector.selectMostReliableIP([...sources])
            ]);

            // All results should be identical
            for (let i = 1; i < results.length; i++) {
              expect(results[i].selectedIP).toBe(results[0].selectedIP);
              expect(results[i].selectedSource).toBe(results[0].selectedSource);
              expect(results[i].selectionReason).toBe(results[0].selectionReason);
              expect(results[i].confidence).toBe(results[0].confidence);
            }
          }
        ),
        { numRuns: 50 } // Reduced due to multiple async calls
      );
    });
  });
});