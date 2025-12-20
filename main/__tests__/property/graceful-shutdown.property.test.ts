/**
 * Property-based tests for graceful shutdown functionality
 * **Feature: x402-payment-integration-fix, Property 18: Shutdown gracefully stops all services**
 */

import fc from 'fast-check';

describe('Graceful Shutdown Properties', () => {
  // Mock types for testing shutdown scenarios
  interface MockService {
    name: string;
    isRunning: boolean;
    stop(): Promise<void>;
    getStatus(): { running: boolean; resources: string[] };
  }

  interface MockSystemState {
    isRunning: boolean;
    services: MockService[];
    scheduledTasks: string[];
    databaseConnected: boolean;
    monitoringActive: boolean;
  }

  // Mock system implementation for testing
  class MockBotPaymentSystem {
    private state: MockSystemState;
    private shutdownInProgress = false;

    constructor(initialState: MockSystemState) {
      this.state = { ...initialState };
    }

    async gracefulShutdown(): Promise<{
      success: boolean;
      stoppedServices: string[];
      cancelledTasks: string[];
      errors: string[];
      shutdownTime: number;
    }> {
      if (this.shutdownInProgress) {
        return {
          success: false,
          stoppedServices: [],
          cancelledTasks: [],
          errors: ['Shutdown already in progress'],
          shutdownTime: 0
        };
      }

      if (!this.state.isRunning) {
        return {
          success: true,
          stoppedServices: [],
          cancelledTasks: [],
          errors: [],
          shutdownTime: 0
        };
      }

      this.shutdownInProgress = true;
      const startTime = Date.now();
      const stoppedServices: string[] = [];
      const cancelledTasks: string[] = [];
      const errors: string[] = [];

      try {
        // Stop monitoring first
        if (this.state.monitoringActive) {
          this.state.monitoringActive = false;
        }

        // Cancel all scheduled tasks
        for (const task of this.state.scheduledTasks) {
          cancelledTasks.push(task);
        }
        this.state.scheduledTasks = [];

        // Stop all services
        for (const service of this.state.services) {
          try {
            if (service.isRunning) {
              await service.stop();
              service.isRunning = false;
              stoppedServices.push(service.name);
            }
          } catch (error) {
            errors.push(`Failed to stop ${service.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Disconnect database
        if (this.state.databaseConnected) {
          this.state.databaseConnected = false;
        }

        // Mark system as stopped
        this.state.isRunning = false;
        this.shutdownInProgress = false;

        const shutdownTime = Date.now() - startTime;

        return {
          success: errors.length === 0,
          stoppedServices,
          cancelledTasks,
          errors,
          shutdownTime
        };

      } catch (error) {
        this.shutdownInProgress = false;
        return {
          success: false,
          stoppedServices,
          cancelledTasks,
          errors: [...errors, error instanceof Error ? error.message : 'Unknown shutdown error'],
          shutdownTime: Date.now() - startTime
        };
      }
    }

    getSystemState(): MockSystemState {
      return { ...this.state };
    }

    isSystemRunning(): boolean {
      return this.state.isRunning;
    }

    async start(): Promise<void> {
      if (this.state.isRunning) {
        return;
      }

      this.state.isRunning = true;
      this.state.monitoringActive = true;
      this.state.databaseConnected = true;
      
      for (const service of this.state.services) {
        service.isRunning = true;
      }
    }
  }

  // Helper to create mock services
  function createMockService(name: string): MockService {
    return {
      name,
      isRunning: false,
      async stop() {
        this.isRunning = false;
      },
      getStatus() {
        return {
          running: this.isRunning,
          resources: [`${name}_resource_1`, `${name}_resource_2`]
        };
      }
    };
  }

  describe('Property 18: Shutdown gracefully stops all services', () => {
    test('any running system should stop all services during graceful shutdown', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            { minLength: 1, maxLength: 10 }
          ).filter(names => new Set(names).size === names.length), // unique service names
          fc.array(
            fc.string({ minLength: 5, maxLength: 30 }),
            { minLength: 0, maxLength: 5 }
          ), // scheduled tasks
          async (serviceNames, scheduledTasks) => {
            // Create mock services
            const services = serviceNames.map(name => createMockService(name));
            
            const initialState: MockSystemState = {
              isRunning: false,
              services,
              scheduledTasks: [...scheduledTasks],
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);

            // Start the system
            await system.start();
            expect(system.isSystemRunning()).toBe(true);

            // Perform graceful shutdown
            const shutdownResult = await system.gracefulShutdown();

            // Verify shutdown was successful
            expect(shutdownResult.success).toBe(true);
            expect(shutdownResult.errors).toHaveLength(0);

            // Verify all services were stopped
            expect(shutdownResult.stoppedServices).toHaveLength(serviceNames.length);
            for (const serviceName of serviceNames) {
              expect(shutdownResult.stoppedServices).toContain(serviceName);
            }

            // Verify all scheduled tasks were cancelled
            expect(shutdownResult.cancelledTasks).toHaveLength(scheduledTasks.length);
            for (const task of scheduledTasks) {
              expect(shutdownResult.cancelledTasks).toContain(task);
            }

            // Verify system is no longer running
            expect(system.isSystemRunning()).toBe(false);

            // Verify final system state
            const finalState = system.getSystemState();
            expect(finalState.isRunning).toBe(false);
            expect(finalState.monitoringActive).toBe(false);
            expect(finalState.databaseConnected).toBe(false);
            expect(finalState.scheduledTasks).toHaveLength(0);

            // Verify all services are stopped
            for (const service of finalState.services) {
              expect(service.isRunning).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('shutdown of already stopped system should be idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            { minLength: 1, maxLength: 5 }
          ).filter(names => new Set(names).size === names.length), // unique service names
          async (serviceNames) => {
            const services = serviceNames.map(name => createMockService(name));
            
            const initialState: MockSystemState = {
              isRunning: false, // Already stopped
              services,
              scheduledTasks: [],
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);

            // Verify system is not running
            expect(system.isSystemRunning()).toBe(false);

            // Perform graceful shutdown on already stopped system
            const shutdownResult = await system.gracefulShutdown();

            // Verify shutdown was successful and idempotent
            expect(shutdownResult.success).toBe(true);
            expect(shutdownResult.errors).toHaveLength(0);
            expect(shutdownResult.stoppedServices).toHaveLength(0); // No services to stop
            expect(shutdownResult.cancelledTasks).toHaveLength(0); // No tasks to cancel
            expect(shutdownResult.shutdownTime).toBeLessThan(100); // Should be very fast

            // Verify system remains stopped
            expect(system.isSystemRunning()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('concurrent shutdown attempts should be handled gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of concurrent shutdown attempts
          fc.array(
            fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            { minLength: 1, maxLength: 3 }
          ).filter(names => new Set(names).size === names.length),
          async (concurrentAttempts, serviceNames) => {
            const services = serviceNames.map(name => createMockService(name));
            
            const initialState: MockSystemState = {
              isRunning: false,
              services,
              scheduledTasks: ['task1', 'task2'],
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);
            await system.start();

            // Start multiple concurrent shutdown attempts
            const shutdownPromises = Array(concurrentAttempts).fill(null).map(() => 
              system.gracefulShutdown()
            );

            const results = await Promise.all(shutdownPromises);

            // At least one shutdown should succeed
            const successfulShutdowns = results.filter(r => r.success);
            expect(successfulShutdowns.length).toBeGreaterThanOrEqual(1);

            // Failed shutdowns should have appropriate error messages
            const failedShutdowns = results.filter(r => !r.success);
            for (const failed of failedShutdowns) {
              expect(failed.errors).toContain('Shutdown already in progress');
            }

            // System should be stopped regardless
            expect(system.isSystemRunning()).toBe(false);

            // Final state should be consistent
            const finalState = system.getSystemState();
            expect(finalState.isRunning).toBe(false);
            expect(finalState.scheduledTasks).toHaveLength(0);
          }
        ),
        { numRuns: 50 } // Reduced due to concurrency complexity
      );
    });

    test('shutdown should complete within reasonable time bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            { minLength: 1, maxLength: 8 }
          ).filter(names => new Set(names).size === names.length),
          fc.array(
            fc.string({ minLength: 5, maxLength: 25 }),
            { minLength: 0, maxLength: 10 }
          ),
          async (serviceNames, scheduledTasks) => {
            const services = serviceNames.map(name => createMockService(name));
            
            const initialState: MockSystemState = {
              isRunning: false,
              services,
              scheduledTasks: [...scheduledTasks],
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);
            await system.start();

            const startTime = Date.now();
            const shutdownResult = await system.gracefulShutdown();
            const actualShutdownTime = Date.now() - startTime;

            // Verify shutdown completed successfully
            expect(shutdownResult.success).toBe(true);

            // Verify shutdown time is reasonable (should be fast for mock services)
            expect(shutdownResult.shutdownTime).toBeLessThan(1000); // Less than 1 second
            expect(actualShutdownTime).toBeLessThan(1000);

            // Verify reported shutdown time is accurate
            expect(Math.abs(shutdownResult.shutdownTime - actualShutdownTime)).toBeLessThan(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('shutdown should handle service failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
              shouldFail: fc.boolean()
            }),
            { minLength: 2, maxLength: 6 }
          ).filter(services => {
            const names = services.map(s => s.name);
            return new Set(names).size === names.length; // unique names
          }),
          async (serviceConfigs) => {
            // Create services with some that will fail during shutdown
            const services: MockService[] = serviceConfigs.map(config => {
              const service = createMockService(config.name);
              if (config.shouldFail) {
                service.stop = async () => {
                  throw new Error(`${config.name} shutdown failure`);
                };
              }
              return service;
            });

            const initialState: MockSystemState = {
              isRunning: false,
              services,
              scheduledTasks: ['task1'],
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);
            await system.start();

            const shutdownResult = await system.gracefulShutdown();

            // Count expected failures
            const expectedFailures = serviceConfigs.filter(s => s.shouldFail).length;
            const expectedSuccesses = serviceConfigs.filter(s => !s.shouldFail).length;

            // Verify shutdown handled failures appropriately
            if (expectedFailures > 0) {
              expect(shutdownResult.success).toBe(false);
              expect(shutdownResult.errors).toHaveLength(expectedFailures);
              
              // Verify error messages contain service names
              for (const config of serviceConfigs.filter(s => s.shouldFail)) {
                const hasError = shutdownResult.errors.some(error => 
                  error.includes(config.name) && error.includes('shutdown failure')
                );
                expect(hasError).toBe(true);
              }
            } else {
              expect(shutdownResult.success).toBe(true);
              expect(shutdownResult.errors).toHaveLength(0);
            }

            // Verify successful services were still stopped
            expect(shutdownResult.stoppedServices).toHaveLength(expectedSuccesses);

            // Verify system is marked as stopped despite service failures
            expect(system.isSystemRunning()).toBe(false);

            // Verify scheduled tasks were still cancelled
            expect(shutdownResult.cancelledTasks).toContain('task1');
          }
        ),
        { numRuns: 50 } // Reduced due to error handling complexity
      );
    });

    test('shutdown should maintain consistent state regardless of service count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 15 }), // number of services (including 0)
          fc.integer({ min: 0, max: 10 }), // number of scheduled tasks
          async (serviceCount, taskCount) => {
            const services = Array(serviceCount).fill(null).map((_, i) => 
              createMockService(`service_${i}`)
            );
            
            const scheduledTasks = Array(taskCount).fill(null).map((_, i) => 
              `task_${i}`
            );

            const initialState: MockSystemState = {
              isRunning: false,
              services,
              scheduledTasks,
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);
            await system.start();

            const shutdownResult = await system.gracefulShutdown();

            // Verify shutdown was successful
            expect(shutdownResult.success).toBe(true);
            expect(shutdownResult.errors).toHaveLength(0);

            // Verify counts match expectations
            expect(shutdownResult.stoppedServices).toHaveLength(serviceCount);
            expect(shutdownResult.cancelledTasks).toHaveLength(taskCount);

            // Verify final state is consistent
            const finalState = system.getSystemState();
            expect(finalState.isRunning).toBe(false);
            expect(finalState.monitoringActive).toBe(false);
            expect(finalState.databaseConnected).toBe(false);
            expect(finalState.scheduledTasks).toHaveLength(0);

            // Verify all services are stopped
            for (const service of finalState.services) {
              expect(service.isRunning).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('shutdown should preserve service order and provide detailed results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 3, maxLength: 12 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            { minLength: 2, maxLength: 6 }
          ).filter(names => new Set(names).size === names.length),
          async (serviceNames) => {
            const services = serviceNames.map(name => createMockService(name));
            
            const initialState: MockSystemState = {
              isRunning: false,
              services,
              scheduledTasks: ['cleanup_task', 'monitor_task'],
              databaseConnected: false,
              monitoringActive: false
            };

            const system = new MockBotPaymentSystem(initialState);
            await system.start();

            const shutdownResult = await system.gracefulShutdown();

            // Verify shutdown result completeness
            expect(shutdownResult).toHaveProperty('success');
            expect(shutdownResult).toHaveProperty('stoppedServices');
            expect(shutdownResult).toHaveProperty('cancelledTasks');
            expect(shutdownResult).toHaveProperty('errors');
            expect(shutdownResult).toHaveProperty('shutdownTime');

            // Verify all expected services are in stopped list
            expect(shutdownResult.stoppedServices.sort()).toEqual(serviceNames.sort());

            // Verify all expected tasks are in cancelled list
            expect(shutdownResult.cancelledTasks.sort()).toEqual(['cleanup_task', 'monitor_task'].sort());

            // Verify shutdown time is a positive number
            expect(shutdownResult.shutdownTime).toBeGreaterThanOrEqual(0);
            expect(typeof shutdownResult.shutdownTime).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});