const fc = require('fast-check');
const { 
  activeTimers, 
  getActiveTimersCount, 
  getActiveIPs, 
  hasActiveTimer, 
  clearAllTimers,
  TimerManager 
} = require('./access-server');

// Mock CloudflareClient for testing
class MockCloudflareClient {
  async deleteRule(ruleId) {
    return Promise.resolve();
  }
}

describe('Property Tests: ActiveTimers State Management', () => {
  let timerManager;
  let mockCloudflareClient;
  
  beforeEach(() => {
    timerManager = new TimerManager();
    mockCloudflareClient = new MockCloudflareClient();
    clearAllTimers(); // Clear any existing timers
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    clearAllTimers();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
  
  /**
   * Property 10: ActiveTimers State Management
   * The activeTimers Map should maintain consistent state:
   * 1. Count should match actual entries
   * 2. IP list should match Map keys
   * 3. hasActiveTimer should reflect Map.has()
   * 4. clearAllTimers should remove all entries and cancel timers
   * Validates: Requirements 1.3, 4.3
   */
  
  describe('Property 10: ActiveTimers State Management', () => {
    test('should maintain consistent count with actual entries', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.tuple(fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })), { minLength: 0, maxLength: 10 }),
        async (ipRulePairs) => {
          // Filter to ensure unique IPs
          const uniquePairs = ipRulePairs.filter((pair, index, arr) => 
            arr.findIndex(p => p[0] === pair[0]) === index
          );
          
          // Start timers for all unique IPs
          for (const [ip, ruleId] of uniquePairs) {
            timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          }
          
          // Count should match number of unique IPs
          expect(getActiveTimersCount()).toBe(uniquePairs.length);
          expect(getActiveTimersCount()).toBe(activeTimers.size);
          
          // Each IP should be tracked
          for (const [ip] of uniquePairs) {
            expect(hasActiveTimer(ip)).toBe(true);
            expect(activeTimers.has(ip)).toBe(true);
          }
        }
      ), { numRuns: 5 });
    });
    
    test('should maintain consistent IP list with Map keys', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.tuple(fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })), { minLength: 0, maxLength: 8 }),
        async (ipRulePairs) => {
          // Filter to ensure unique IPs
          const uniquePairs = ipRulePairs.filter((pair, index, arr) => 
            arr.findIndex(p => p[0] === pair[0]) === index
          );
          
          // Start timers for all unique IPs
          for (const [ip, ruleId] of uniquePairs) {
            timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          }
          
          const activeIPs = getActiveIPs();
          const mapKeys = Array.from(activeTimers.keys());
          
          // IP lists should be identical
          expect(activeIPs.sort()).toEqual(mapKeys.sort());
          expect(activeIPs.length).toBe(uniquePairs.length);
          
          // Each expected IP should be in the list
          for (const [ip] of uniquePairs) {
            expect(activeIPs).toContain(ip);
          }
        }
      ), { numRuns: 5 });
    });
    
    test('should reflect hasActiveTimer correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.ipV4(), { minLength: 1, maxLength: 5 }),
        fc.ipV4(), // Test IP that may or may not be in the active list
        async (activeIPs, testIP) => {
          // Filter to unique IPs
          const uniqueActiveIPs = [...new Set(activeIPs)];
          
          // Start timers for active IPs
          for (const ip of uniqueActiveIPs) {
            timerManager.startTimer(ip, `rule-${ip}`, mockCloudflareClient);
          }
          
          // hasActiveTimer should match Map.has() for all IPs
          const isTestIPActive = uniqueActiveIPs.includes(testIP);
          expect(hasActiveTimer(testIP)).toBe(isTestIPActive);
          expect(hasActiveTimer(testIP)).toBe(activeTimers.has(testIP));
          
          // Check all active IPs
          for (const ip of uniqueActiveIPs) {
            expect(hasActiveTimer(ip)).toBe(true);
            expect(activeTimers.has(ip)).toBe(true);
          }
        }
      ), { numRuns: 5 });
    });
    
    test('should clear all timers and state correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.tuple(fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })), { minLength: 1, maxLength: 8 }),
        async (ipRulePairs) => {
          // Filter to ensure unique IPs
          const uniquePairs = ipRulePairs.filter((pair, index, arr) => 
            arr.findIndex(p => p[0] === pair[0]) === index
          );
          
          // Start timers for all unique IPs
          for (const [ip, ruleId] of uniquePairs) {
            timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          }
          
          // Verify timers are active
          expect(getActiveTimersCount()).toBe(uniquePairs.length);
          expect(getActiveIPs().length).toBe(uniquePairs.length);
          
          // Clear all timers
          clearAllTimers();
          
          // All state should be cleared
          expect(getActiveTimersCount()).toBe(0);
          expect(activeTimers.size).toBe(0);
          expect(getActiveIPs()).toEqual([]);
          
          // No IP should have active timer
          for (const [ip] of uniquePairs) {
            expect(hasActiveTimer(ip)).toBe(false);
          }
          
          // Fast-forward time - no cleanup should happen since timers were cleared
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // State should remain empty
          expect(getActiveTimersCount()).toBe(0);
        }
      ), { numRuns: 5 });
    });
    
    test('should handle timer expiration and state cleanup', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.tuple(fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })), { minLength: 1, maxLength: 5 }),
        async (ipRulePairs) => {
          // Filter to ensure unique IPs
          const uniquePairs = ipRulePairs.filter((pair, index, arr) => 
            arr.findIndex(p => p[0] === pair[0]) === index
          );
          
          // Start timers for all unique IPs
          for (const [ip, ruleId] of uniquePairs) {
            timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          }
          
          // Verify initial state
          expect(getActiveTimersCount()).toBe(uniquePairs.length);
          
          // Fast-forward time to trigger all timers
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // All state should be cleared after expiration
          expect(getActiveTimersCount()).toBe(0);
          expect(activeTimers.size).toBe(0);
          expect(getActiveIPs()).toEqual([]);
          
          // No IP should have active timer
          for (const [ip] of uniquePairs) {
            expect(hasActiveTimer(ip)).toBe(false);
          }
        }
      ), { numRuns: 5 });
    });
    
    test('should handle partial timer cancellation', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.ipV4(), { minLength: 3, maxLength: 6 }),
        fc.integer({ min: 1, max: 2 }), // Number of timers to cancel
        async (ips, cancelCount) => {
          // Filter to unique IPs
          const uniqueIPs = [...new Set(ips)];
          if (uniqueIPs.length < 3) return; // Skip if not enough unique IPs
          
          // Start timers for all IPs
          for (const ip of uniqueIPs) {
            timerManager.startTimer(ip, `rule-${ip}`, mockCloudflareClient);
          }
          
          // Verify initial state
          expect(getActiveTimersCount()).toBe(uniqueIPs.length);
          
          // Cancel some timers
          const ipsToCancel = uniqueIPs.slice(0, Math.min(cancelCount, uniqueIPs.length - 1));
          for (const ip of ipsToCancel) {
            timerManager.cancelTimer(ip);
          }
          
          // State should reflect cancellations
          const expectedActiveCount = uniqueIPs.length - ipsToCancel.length;
          expect(getActiveTimersCount()).toBe(expectedActiveCount);
          expect(getActiveIPs().length).toBe(expectedActiveCount);
          
          // Cancelled IPs should not be active
          for (const ip of ipsToCancel) {
            expect(hasActiveTimer(ip)).toBe(false);
          }
          
          // Remaining IPs should still be active
          const remainingIPs = uniqueIPs.filter(ip => !ipsToCancel.includes(ip));
          for (const ip of remainingIPs) {
            expect(hasActiveTimer(ip)).toBe(true);
          }
        }
      ), { numRuns: 10 });
    });
  });
  
  describe('State Consistency Under Concurrent Operations', () => {
    test('should maintain consistency when starting multiple timers rapidly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.tuple(fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })), { minLength: 2, maxLength: 5 }),
        async (ipRulePairs) => {
          // Filter to ensure unique IPs
          const uniquePairs = ipRulePairs.filter((pair, index, arr) => 
            arr.findIndex(p => p[0] === pair[0]) === index
          );
          
          if (uniquePairs.length < 2) return;
          
          // Start all timers "simultaneously"
          for (const [ip, ruleId] of uniquePairs) {
            timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          }
          
          // State should be consistent immediately
          expect(getActiveTimersCount()).toBe(uniquePairs.length);
          expect(getActiveIPs().length).toBe(uniquePairs.length);
          expect(activeTimers.size).toBe(uniquePairs.length);
          
          // All utility functions should agree
          for (const [ip] of uniquePairs) {
            expect(hasActiveTimer(ip)).toBe(true);
            expect(activeTimers.has(ip)).toBe(true);
            expect(getActiveIPs()).toContain(ip);
          }
        }
      ), { numRuns: 5 });
    });
    
    test('should handle timer replacement correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }), // First rule ID
        fc.string({ minLength: 1, maxLength: 50 }), // Second rule ID
        async (ip, ruleId1, ruleId2) => {
          // Start first timer
          timerManager.startTimer(ip, ruleId1, mockCloudflareClient);
          expect(getActiveTimersCount()).toBe(1);
          expect(hasActiveTimer(ip)).toBe(true);
          
          // Replace with second timer
          timerManager.startTimer(ip, ruleId2, mockCloudflareClient);
          
          // Count should remain 1 (replacement, not addition)
          expect(getActiveTimersCount()).toBe(1);
          expect(activeTimers.size).toBe(1);
          expect(hasActiveTimer(ip)).toBe(true);
          expect(getActiveIPs()).toEqual([ip]);
        }
      ), { numRuns: 5 });
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle empty state correctly', () => {
      // Initial state should be empty
      expect(getActiveTimersCount()).toBe(0);
      expect(getActiveIPs()).toEqual([]);
      expect(hasActiveTimer('any-ip')).toBe(false);
      
      // Clearing empty state should be safe
      clearAllTimers();
      expect(getActiveTimersCount()).toBe(0);
    });
    
    test('should handle invalid IP queries gracefully', async () => {
      await fc.assert(fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s))
        ),
        (invalidIP) => {
          // Should not throw for invalid IP queries
          expect(() => hasActiveTimer(invalidIP)).not.toThrow();
          expect(hasActiveTimer(invalidIP)).toBe(false);
        }
      ), { numRuns: 5 });
    });
  });
});