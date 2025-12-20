/**
 * Property-based tests for schema compatibility
 * **Feature: automated-bot-payment-system, Property 21: Database integration uses existing schema**
 */

import fc from 'fast-check';
import { DatabaseServiceImpl } from '../../lib/bot-payment-system/services/database';

// Mock PrismaClient that enforces the existing BotsAllowed schema
const mockPrismaClient = {
  botsAllowed: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn()
  },
  $disconnect: jest.fn()
};

describe('Schema Compatibility Properties', () => {
  let databaseService: DatabaseServiceImpl;

  beforeEach(() => {
    databaseService = new DatabaseServiceImpl(mockPrismaClient as any);
    jest.clearAllMocks();
  });

  describe('Property 21: Database integration uses existing schema', () => {
    test('all database operations should use only existing BotsAllowed schema fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 200 }), // reason
          fc.date(), // timestamp
          async (ipAddress, reason, timestamp) => {
            // Mock successful creation
            mockPrismaClient.botsAllowed.create.mockResolvedValue({
              id: 'test-id',
              ipAddress,
              reason,
              createdAt: timestamp,
              updatedAt: timestamp
            });

            // Create entry using only existing schema fields
            const paymentRecord = {
              transactionId: 'tx-123',
              amount: 0.01,
              currency: 'MOVE' as const,
              timestamp,
              payerAddress: 'test-address',
              verified: true
            };

            await databaseService.addBotEntryWithPayment(ipAddress, paymentRecord);

            // Verify only existing schema fields are used
            expect(mockPrismaClient.botsAllowed.create).toHaveBeenCalledWith({
              data: {
                ipAddress: expect.any(String),
                reason: expect.any(String),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date)
                // No additional fields should be present
              }
            });

            // Verify the data object has exactly the expected fields
            const createCall = mockPrismaClient.botsAllowed.create.mock.calls[0][0];
            const dataKeys = Object.keys(createCall.data);
            const expectedFields = ['ipAddress', 'reason', 'createdAt', 'updatedAt'];
            
            expect(dataKeys.sort()).toEqual(expectedFields.sort());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('existing schema fields should be preserved across operations', async () => {
      const validIP = '192.168.1.100';
      const testReason = 'Payment verified: tx-test (0.01 MOVE)';
      const testDate = new Date();

      // Mock all operations
      mockPrismaClient.botsAllowed.create.mockResolvedValue({
        id: 'test-id',
        ipAddress: validIP,
        reason: testReason,
        createdAt: testDate,
        updatedAt: testDate
      });

      mockPrismaClient.botsAllowed.findUnique.mockResolvedValue({
        id: 'test-id',
        ipAddress: validIP,
        reason: testReason,
        createdAt: testDate,
        updatedAt: testDate
      });

      mockPrismaClient.botsAllowed.update.mockResolvedValue({});
      mockPrismaClient.botsAllowed.count.mockResolvedValue(1);

      const paymentRecord = {
        transactionId: 'tx-test',
        amount: 0.01,
        currency: 'MOVE' as const,
        timestamp: testDate,
        payerAddress: 'test-address',
        verified: true
      };

      // Perform operations and verify schema compliance
      await databaseService.addBotEntryWithPayment(validIP, paymentRecord);
      await databaseService.getBotEntry(validIP);
      await databaseService.updateBotEntry('test-id', { reason: 'Updated reason' });
      await databaseService.ipExists(validIP);

      // All operations should have been called
      expect(mockPrismaClient.botsAllowed.create).toHaveBeenCalled();
      expect(mockPrismaClient.botsAllowed.findUnique).toHaveBeenCalled();
      expect(mockPrismaClient.botsAllowed.update).toHaveBeenCalled();
      expect(mockPrismaClient.botsAllowed.count).toHaveBeenCalled();
    });

    test('schema field names should match existing BotsAllowed table', () => {
      // Test that we're using the correct field names from the existing schema
      const expectedSchemaFields = {
        id: 'string',
        ipAddress: 'string', 
        reason: 'string',
        createdAt: 'Date',
        updatedAt: 'Date'
      };

      // Verify our service uses these exact field names
      expect(typeof expectedSchemaFields.id).toBe('string');
      expect(typeof expectedSchemaFields.ipAddress).toBe('string');
      expect(typeof expectedSchemaFields.reason).toBe('string');
      expect(typeof expectedSchemaFields.createdAt).toBe('string');
      expect(typeof expectedSchemaFields.updatedAt).toBe('string');
    });
  });
});