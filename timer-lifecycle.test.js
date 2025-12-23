const fc = require('fast-check');
const { TimerManager, activeTimers, clearAllTimers } = require('./access-server');

// Mock CloudflareClient for testing
class MockCloudflareClient {
  constructor() {
    this.deleteRuleCalls = [];
  }
  
  async deleteRule(ruleId) {
    this.deleteRuleCalls.push(ruleId);
    // Simulate successful deletion
    return Promise.resolve();
  }
  
  getDeleteRuleCalls() {
    return this.deleteRuleCalls;
  }
  
  reset() {
    this.deleteRuleCalls = [];
  }
}

describe('Property Tests: Timer Lifecycle Management', () => {
  let timerManager;
  let mockCloudflareClient;
  
  beforeEach(() => {
    timerManager = new TimerManager();
    mockCloudflareClient = new MockCloudflareClient();
    clearAllTimers(); // Clear any existing timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    clearAllTimers();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
  
  /**
   * Property 3: Timer Lifecycle Management
   * For any IP address and rule ID, starting a timer should:
   * 1. Cancel any existing timer for that IP
   * 2. Create a new timer that expires after 60 seconds
   * 3. Clean up Cloudflare rule and activeTimers entry on expiration
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  
  describe('Property 3: Timer Lifecycle Management', () => {
    test('should start timer and add to activeTimers map', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }), // Rule ID
        async (ip, ruleId) => {
          // Start timer
          timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          
          // Should add IP to activeTimers
          expect(activeTimers.has(ip)).toBe(true);
          expect(activeTimers.size).toBe(1);
          
          // Timer should not have expired yet
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(0);
        }
      ), { numRuns: 15 });
    });
    
    test('should cancel existing timer when starting new one for same IP', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }), // First rule ID
        fc.string({ minLength: 1, maxLength: 50 }), // Second rule ID
        async (ip, ruleId1, ruleId2) => {
          // Start first timer
          timerManager.startTimer(ip, ruleId1, mockCloudflareClient);
          expect(activeTimers.has(ip)).toBe(true);
          
          // Start second timer for same IP (should cancel first)
          timerManager.startTimer(ip, ruleId2, mockCloudflareClient);
          
          // Should still have only one entry for this IP
          expect(activeTimers.has(ip)).toBe(true);
          expect(activeTimers.size).toBe(1);
          
          // Fast-forward time to trigger timer
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // Should have called deleteRule only once (for the second timer)
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(1);
          expect(mockCloudflareClient.getDeleteRuleCalls()[0]).toBe(ruleId2);
          
          // Should remove IP from activeTimers
          expect(activeTimers.has(ip)).toBe(false);
        }
      ), { numRuns: 15 });
    });
    
    test('should clean up after timer expiration', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }), // Rule ID
        async (ip, ruleId) => {
          // Start timer
          timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          expect(activeTimers.has(ip)).toBe(true);
          
          // Fast-forward time to trigger timer expiration
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // Should have called deleteRule with correct ruleId
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(1);
          expect(mockCloudflareClient.getDeleteRuleCalls()[0]).toBe(ruleId);
          
          // Should remove IP from activeTimers
          expect(activeTimers.has(ip)).toBe(false);
          expect(activeTimers.size).toBe(0);
        }
      ), { numRuns: 15 });
    });
    
    test('should handle multiple concurrent timers for different IPs', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.tuple(fc.ipV4(), fc.string({ minLength: 1, maxLength: 50 })), { minLength: 2, maxLength: 5 }),
        async (ipRulePairs) => {
          // Filter to ensure unique IPs
          const uniquePairs = ipRulePairs.filter((pair, index, arr) => 
            arr.findIndex(p => p[0] === pair[0]) === index
          );
          
          if (uniquePairs.length < 2) return; // Skip if not enough unique IPs
          
          // Start timers for all IPs
          for (const [ip, ruleId] of uniquePairs) {
            timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          }
          
          // All IPs should be in activeTimers
          expect(activeTimers.size).toBe(uniquePairs.length);
          for (const [ip] of uniquePairs) {
            expect(activeTimers.has(ip)).toBe(true);
          }
          
          // Fast-forward time to trigger all timers
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // Should have called deleteRule for all rules
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(uniquePairs.length);
          
          // All rule IDs should be present in delete calls
          const deletedRuleIds = mockCloudflareClient.getDeleteRuleCalls();
          for (const [, ruleId] of uniquePairs) {
            expect(deletedRuleIds).toContain(ruleId);
          }
          
          // All IPs should be removed from activeTimers
          expect(activeTimers.size).toBe(0);
        }
      ), { numRuns: 10 });
    });
    
    test('should handle timer cancellation correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }), // Rule ID
        async (ip, ruleId) => {
          // Start timer
          timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          expect(activeTimers.has(ip)).toBe(true);
          
          // Cancel timer before expiration
          timerManager.cancelTimer(ip);
          
          // Should remove IP from activeTimers immediately
          expect(activeTimers.has(ip)).toBe(false);
          expect(activeTimers.size).toBe(0);
          
          // Fast-forward time (timer should not trigger)
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // Should not have called deleteRule
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(0);
        }
      ), { numRuns: 15 });
    });
  });
  
  describe('Timer Duration Validation', () => {
    test('should expire after exactly 60 seconds', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (ip, ruleId) => {
          timerManager.startTimer(ip, ruleId, mockCloudflareClient);
          
          // Should not expire before 60 seconds
          jest.advanceTimersByTime(59999);
          await new Promise(resolve => setImmediate(resolve));
          expect(activeTimers.has(ip)).toBe(true);
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(0);
          
          // Should expire at exactly 60 seconds
          jest.advanceTimersByTime(1);
          await new Promise(resolve => setImmediate(resolve));
          expect(activeTimers.has(ip)).toBe(false);
          expect(mockCloudflareClient.getDeleteRuleCalls()).toHaveLength(1);
        }
      ), { numRuns: 10 });
    });
  });
  
  describe('Error Handling During Cleanup', () => {
    test('should remove from activeTimers even if Cloudflare deletion fails', async () => {
      await fc.assert(fc.asyncProperty(
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (ip, ruleId) => {
          // Create mock client that throws error on deleteRule
          const errorClient = {
            deleteRule: jest.fn().mockRejectedValue(new Error('Cloudflare API error'))
          };
          
          timerManager.startTimer(ip, ruleId, errorClient);
          expect(activeTimers.has(ip)).toBe(true);
          
          // Fast-forward time to trigger timer
          jest.advanceTimersByTime(60000);
          await new Promise(resolve => setImmediate(resolve));
          
          // Should still remove from activeTimers despite error
          expect(activeTimers.has(ip)).toBe(false);
          expect(errorClient.deleteRule).toHaveBeenCalledWith(ruleId);
        }
      ), { numRuns: 10 });
    });
  });
});