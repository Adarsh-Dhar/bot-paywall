/**
 * Database Service for managing BotsAllowed table operations
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseService } from '../interfaces';
import { BotAllowedEntry, PaymentRecord } from '../types';

export class DatabaseServiceImpl implements DatabaseService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Adds a new bot entry to the BotsAllowed table
   */
  async addBotEntry(entry: BotAllowedEntry): Promise<void> {
    try {
      await this.prisma.botsAllowed.create({
        data: {
          ipAddress: entry.ipAddress,
          reason: entry.reason,
          createdAt: entry.createdAt,
          updatedAt: entry.createdAt
        }
      });
    } catch (error) {
      throw new Error(`Failed to add bot entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates an existing bot entry in the BotsAllowed table
   */
  async updateBotEntry(id: string, updates: Partial<BotAllowedEntry>): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      // Map BotAllowedEntry fields to Prisma schema fields
      if (updates.ipAddress) updateData.ipAddress = updates.ipAddress;
      if (updates.reason) updateData.reason = updates.reason;

      await this.prisma.botsAllowed.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      throw new Error(`Failed to update bot entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves a bot entry by IP address
   */
  async getBotEntry(ip: string): Promise<BotAllowedEntry | null> {
    try {
      const entry = await this.prisma.botsAllowed.findUnique({
        where: { ipAddress: ip }
      });

      if (!entry) {
        return null;
      }

      // Convert Prisma result to BotAllowedEntry format
      return this.convertPrismaEntryToBotAllowedEntry(entry);
    } catch (error) {
      throw new Error(`Failed to get bot entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if an IP address already exists in the BotsAllowed table
   */
  async ipExists(ip: string): Promise<boolean> {
    try {
      const count = await this.prisma.botsAllowed.count({
        where: { ipAddress: ip }
      });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check IP existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Adds a bot entry with payment information
   */
  async addBotEntryWithPayment(ip: string, paymentRecord: PaymentRecord, whitelistRuleId?: string): Promise<string> {
    try {
      const reason = `Payment verified: ${paymentRecord.transactionId} (${paymentRecord.amount} ${paymentRecord.currency})`;
      
      const entry = await this.prisma.botsAllowed.create({
        data: {
          ipAddress: ip,
          reason,
          createdAt: paymentRecord.timestamp,
          updatedAt: paymentRecord.timestamp
        }
      });

      return entry.id;
    } catch (error) {
      throw new Error(`Failed to add bot entry with payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates a bot entry with expiration information after cleanup
   */
  async markEntryAsExpired(id: string, expirationTime: Date): Promise<void> {
    try {
      await this.prisma.botsAllowed.update({
        where: { id },
        data: {
          reason: `${await this.getEntryReason(id)} - Expired at ${expirationTime.toISOString()}`,
          updatedAt: expirationTime
        }
      });
    } catch (error) {
      throw new Error(`Failed to mark entry as expired: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets all bot entries (for monitoring/admin purposes)
   */
  async getAllBotEntries(): Promise<BotAllowedEntry[]> {
    try {
      const entries = await this.prisma.botsAllowed.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return entries.map(entry => this.convertPrismaEntryToBotAllowedEntry(entry));
    } catch (error) {
      throw new Error(`Failed to get all bot entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Removes old bot entries (cleanup function)
   */
  async removeExpiredEntries(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.botsAllowed.deleteMany({
        where: {
          createdAt: {
            lt: olderThan
          }
        }
      });

      return result.count;
    } catch (error) {
      throw new Error(`Failed to remove expired entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Closes the database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Private helper to get entry reason
   */
  private async getEntryReason(id: string): Promise<string> {
    const entry = await this.prisma.botsAllowed.findUnique({
      where: { id },
      select: { reason: true }
    });
    return entry?.reason || 'Unknown';
  }

  /**
   * Converts Prisma BotsAllowed entry to BotAllowedEntry format
   */
  private convertPrismaEntryToBotAllowedEntry(prismaEntry: any): BotAllowedEntry {
    // TODO: Update database schema to properly store payment records
    throw new Error('Payment record storage not implemented. Database schema needs to be updated to store real payment data.');
  }
}