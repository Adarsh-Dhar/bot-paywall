/**
 * Property-based tests for database operations
 * **Feature: automated-bot-payment-system, Property 4: IP addresses are stored with payment timestamps**
 */

import fc from 'fast-check';
import { DatabaseServiceImpl } from '../../lib/bot-payment-system/services/database';
import { PaymentRecord, BotAllowedEntry } from '../../lib/bot-payment-system/types';

// Mock PrismaClient for testing
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

describe('Database Operations Properties', () => {
  let databaseService: DatabaseServiceImpl;

  beforeEach(() => {
    databaseService = new DatabaseServiceImpl(mockPrismaClient as any);
    jest.clearAllMocks();
  });

  describe('Property 4: IP addresses are stored with payment timestamps', () => {
    test('any IP address with payment record should be stored with correct timestamp', async () => {
      // Mock successful database creation
      mockPrismaClient.botsAllowed.create.mockResolvedValue({
        id: 'test-id',
        ipAddress: '192.168.1.1',
        reason: 'Payment verified',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.date(), // payment timestamp
          fc.string({ minLength: 1, maxLength: 42 }), // payer address
          async (ip, transactionId, timestamp, payerAddress) => {
            const paymentRecord: PaymentRecord = {
              transactionId,
              amount: 0.01,
              currency: 'MOVE',
              timestamp,
              payerAddress,
              verified: true
            };

            // Store IP with payment record
            const entryId = await databaseService.addBotEntryWithPayment(ip, paymentRecord);

            // Verify the database was called with correct parameters
            expect(mockPrismaClient.botsAllowed.create).toHaveBeenCalledWith({
              data: {
                ipAddress: ip,
                reason: expect.stringContaining(transactionId),
                createdAt: timestamp,
                updatedAt: timestamp
              }
            });

            // Verify entry ID is returned
            expect(entryId).toBeDefined();
            expect(typeof entryId).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('stored entries should be retrievable by IP address', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 64 }), // transaction ID
          fc.date(), // timestamp
          async (ip, transactionId, timestamp) => {
            // Mock database response
            mockPrismaClient.botsAllowed.findUnique.mockResolvedValue({
              id: 'test-id',
              ipAddress: ip,
              reason: `Payment verified: ${transactionId} (0.01 MOVE)`,
              createdAt: timestamp,
              updatedAt: timestamp
            });

            // Retrieve entry by IP
            const entry = await databaseService.getBotEntry(ip);

            // Verify the query was made with correct IP
            expect(mockPrismaClient.botsAllowed.findUnique).toHaveBeenCalledWith({
              where: { ipAddress: ip }
            });

            // Verify entry structure
            expect(entry).not.toBeNull();
            expect(entry!.ipAddress).toBe(ip);
            expect(entry!.paymentRecord.timestamp).toEqual(timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('IP existence check should work for any valid IP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.boolean(), // whether IP exists
          async (ip, exists) => {
            // Mock database response
            mockPrismaClient.botsAllowed.count.mockResolvedValue(exists ? 1 : 0);

            // Check IP existence
            const ipExists = await databaseService.ipExists(ip);

            // Verify the query was made with correct IP
            expect(mockPrismaClient.botsAllowed.count).toHaveBeenCalledWith({
              where: { ipAddress: ip }
            });

            // Verify result matches mock
            expect(ipExists).toBe(exists);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('entry updates should preserve IP and update timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.string({ minLength: 7, maxLength: 15 }).filter(s => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)), // valid IP
          fc.string({ minLength: 1, maxLength: 200 }), // new reason
          async (entryId, newIp, newReason) => {
            // Mock successful update
            mockPrismaClient.botsAllowed.update.mockResolvedValue({});

            const updates: Partial<BotAllowedEntry> = {
              ipAddress: newIp,
              reason: newReason
            };

            // Update entry
            await databaseService.updateBotEntry(entryId, updates);

            // Verify the update was called with correct parameters
            expect(mockPrismaClient.botsAllowed.update).toHaveBeenCalledWith({
              where: { id: entryId },
              data: {
                ipAddress: newIp,
                reason: newReason,
                updatedAt: expect.any(Date)
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('expired entries cleanup should work for any date threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date(), // expiration threshold
          fc.integer({ min: 0, max: 100 }), // number of deleted entries
          async (expirationDate, deletedCount) => {
            // Mock deletion result
            mockPrismaClient.botsAllowed.deleteMany.mockResolvedValue({ count: deletedCount });

            // Remove expired entries
            const actualDeletedCount = await databaseService.removeExpiredEntries(expirationDate);

            // Verify the deletion was called with correct date
            expect(mockPrismaClient.botsAllowed.deleteMany).toHaveBeenCalledWith({
              where: {
                createdAt: {
                  lt: expirationDate
                }
              }
            });

            // Verify returned count matches mock
            expect(actualDeletedCount).toBe(deletedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('marking entries as expired should update reason and timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 32 }), // entry ID
          fc.date(), // expiration time
          fc.string({ minLength: 1, maxLength: 100 }), // original reason
          async (entryId, expirationTime, originalReason) => {
            // Mock finding the entry reason
            mockPrismaClient.botsAllowed.findUnique.mockResolvedValue({
              reason: originalReason
            });

            // Mock successful update
            mockPrismaClient.botsAllowed.update.mockResolvedValue({});

            // Mark entry as expired
            await databaseService.markEntryAsExpired(entryId, expirationTime);

            // Verify the update was called with correct parameters
            expect(mockPrismaClient.botsAllowed.update).toHaveBeenCalledWith({
              where: { id: entryId },
              data: {
                reason: expect.stringContaining(originalReason),
                updatedAt: expirationTime
              }
            });

            // Verify the reason includes expiration information
            const updateCall = mockPrismaClient.botsAllowed.update.mock.calls[0][0];
            expect(updateCall.data.reason).toContain('Expired at');
            expect(updateCall.data.reason).toContain(expirationTime.toISOString());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('database errors should be properly wrapped and thrown', async () => {
      const testError = new Error('Database connection failed');
      mockPrismaClient.botsAllowed.create.mockRejectedValue(testError);

      const paymentRecord: PaymentRecord = {
        transactionId: 'test-tx',
        amount: 0.01,
        currency: 'MOVE',
        timestamp: new Date(),
        payerAddress: 'test-address',
        verified: true
      };

      await expect(databaseService.addBotEntryWithPayment('192.168.1.1', paymentRecord))
        .rejects.toThrow('Failed to add bot entry with payment');
    });

    test('getAllBotEntries should return properly formatted entries', async () => {
      const mockEntries = [
        {
          id: 'entry1',
          ipAddress: '192.168.1.1',
          reason: 'Payment verified: tx1 (0.01 MOVE)',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        },
        {
          id: 'entry2',
          ipAddress: '192.168.1.2',
          reason: 'Payment verified: tx2 (0.01 MOVE)',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02')
        }
      ];

      mockPrismaClient.botsAllowed.findMany.mockResolvedValue(mockEntries);

      const entries = await databaseService.getAllBotEntries();

      expect(mockPrismaClient.botsAllowed.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      });

      expect(entries).toHaveLength(2);
      entries.forEach((entry, index) => {
        expect(entry.id).toBe(mockEntries[index].id);
        expect(entry.ipAddress).toBe(mockEntries[index].ipAddress);
        expect(entry.reason).toBe(mockEntries[index].reason);
        expect(entry.paymentRecord).toBeDefined();
        expect(entry.paymentRecord.amount).toBe(0.01);
        expect(entry.paymentRecord.currency).toBe('MOVE');
      });
    });
  });
});