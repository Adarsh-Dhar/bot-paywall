/**
 * Cloudflare API Client for managing firewall rules
 */

import { CloudflareClient } from '../interfaces';
import { AccessRule } from '../types';
import { validateIPAddress, formatIPForCloudflare } from '../validation';

export class CloudflareClientImpl implements CloudflareClient {
  private readonly apiToken: string;
  private readonly zoneId: string;
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';
  private readonly rateLimitDelay = 1000; // 1 second delay for rate limiting
  private readonly maxRetries = 3;

  constructor(apiToken?: string, zoneId?: string) {
    // Use existing configuration from environment or provided values
    this.apiToken = apiToken || process.env.CLOUDFLARE_API_TOKEN || 'oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB';
    this.zoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID || '11685346bf13dc3ffebc9cc2866a8105';
  }

  /**
   * Creates a new access rule (whitelist) for the specified IP
   */
  async createAccessRule(ip: string, mode: 'whitelist'): Promise<AccessRule> {
    // Validate and format IP address for Cloudflare
    if (!validateIPAddress(ip)) {
      throw new Error(`Invalid IP address format: ${ip}`);
    }
    
    const formattedIP = formatIPForCloudflare(ip);
    const url = `${this.baseUrl}/zones/${this.zoneId}/firewall/access_rules/rules`;
    
    const payload = {
      mode: mode,
      configuration: {
        target: 'ip' as const,
        value: formattedIP
      },
      notes: 'Automated bot payment system - temporary access'
    };

    try {
      const response = await this.makeApiRequest('POST', url, payload);
      
      if (!response.success) {
        throw new Error(`Cloudflare API error: ${response.errors?.[0]?.message || 'Unknown error'}`);
      }

      return {
        id: response.result.id,
        mode: response.result.mode,
        configuration: response.result.configuration,
        notes: response.result.notes
      };
    } catch (error) {
      throw new Error(`Failed to create access rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deletes an existing access rule by ID
   */
  async deleteAccessRule(ruleId: string): Promise<void> {
    const url = `${this.baseUrl}/zones/${this.zoneId}/firewall/access_rules/rules/${ruleId}`;

    try {
      const response = await this.makeApiRequest('DELETE', url);
      
      if (!response.success) {
        throw new Error(`Cloudflare API error: ${response.errors?.[0]?.message || 'Unknown error'}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete access rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lists access rules, optionally filtered by IP address
   */
  async listAccessRules(ip?: string): Promise<AccessRule[]> {
    let url = `${this.baseUrl}/zones/${this.zoneId}/firewall/access_rules/rules`;
    
    if (ip) {
      // Validate and format IP if provided
      if (!validateIPAddress(ip)) {
        throw new Error(`Invalid IP address format: ${ip}`);
      }
      const formattedIP = formatIPForCloudflare(ip);
      url += `?configuration.value=${encodeURIComponent(formattedIP)}`;
    }

    try {
      const response = await this.makeApiRequest('GET', url);
      
      if (!response.success) {
        throw new Error(`Cloudflare API error: ${response.errors?.[0]?.message || 'Unknown error'}`);
      }

      return response.result.map((rule: any) => ({
        id: rule.id,
        mode: rule.mode,
        configuration: rule.configuration,
        notes: rule.notes
      }));
    } catch (error) {
      throw new Error(`Failed to list access rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Finds an existing rule for a specific IP address
   */
  async findRuleForIP(ip: string): Promise<AccessRule | null> {
    try {
      const rules = await this.listAccessRules(ip);
      return rules.length > 0 ? rules[0] : null;
    } catch (error) {
      throw new Error(`Failed to find rule for IP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates or updates a whitelist rule for an IP (prevents duplicates)
   */
  async ensureWhitelistRule(ip: string): Promise<AccessRule> {
    try {
      // Check if rule already exists
      const existingRule = await this.findRuleForIP(ip);
      
      if (existingRule) {
        // If it's already a whitelist rule, return it
        if (existingRule.mode === 'whitelist') {
          return existingRule;
        }
        
        // If it's a different type of rule, delete it first
        await this.deleteAccessRule(existingRule.id);
      }

      // Create new whitelist rule
      return await this.createAccessRule(ip, 'whitelist');
    } catch (error) {
      throw new Error(`Failed to ensure whitelist rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Makes an API request with retry logic and rate limiting
   */
  private async makeApiRequest(method: string, url: string, body?: any, retryCount = 0): Promise<any> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      // Handle rate limiting
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          const delay = this.rateLimitDelay * Math.pow(2, retryCount); // Exponential backoff
          await this.sleep(delay);
          return this.makeApiRequest(method, url, body, retryCount + 1);
        } else {
          throw new Error('Rate limit exceeded after maximum retries');
        }
      }

      // Handle other HTTP errors
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.rateLimitDelay * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.makeApiRequest(method, url, body, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true; // Network errors
    }
    
    if (error.message && error.message.includes('timeout')) {
      return true; // Timeout errors
    }
    
    return false;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates API configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.apiToken) {
      errors.push('Cloudflare API token is required');
    }

    if (!this.zoneId) {
      errors.push('Cloudflare Zone ID is required');
    }

    // Basic format validation for zone ID (should be 32 hex characters)
    if (this.zoneId && !/^[a-f0-9]{32}$/i.test(this.zoneId)) {
      errors.push('Invalid Zone ID format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Tests the API connection and permissions
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = this.validateConfiguration();
      if (!validation.valid) {
        return {
          success: false,
          error: `Configuration errors: ${validation.errors.join(', ')}`
        };
      }

      // Test by listing rules (should work with minimal permissions)
      await this.listAccessRules();
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}