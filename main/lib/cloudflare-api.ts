/**
 * Cloudflare API Utilities
 * Handles all interactions with the Cloudflare API
 */

import {
  CloudflareZoneResponse,
  CloudflareZoneStatusResponse,
  WAFRulesetResponse,
  WAFSkipRule,
} from '@/types/gatekeeper';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

function getHeaders(token: string): HeadersInit {
  if (!token) {
    throw new Error('Cloudflare API token is required');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a new Cloudflare zone for a domain
 */
export async function createCloudflareZone(
  domain: string,
  token: string
): Promise<CloudflareZoneResponse> {
  if (!token) {
    throw new Error('Cloudflare API token is required');
  }

  // Get account ID from accounts endpoint
  const accountsResponse = await fetch(`${CLOUDFLARE_API_BASE}/accounts`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  const accountsData = await accountsResponse.json();

  if (!accountsResponse.ok || !accountsData.success) {
    throw new Error(
      `Failed to get account ID: ${accountsData.errors?.[0]?.message || 'Unknown error'}`
    );
  }

  if (!accountsData.result || accountsData.result.length === 0) {
    throw new Error('No accounts found for this token');
  }

  const accountId = accountsData.result[0].id;
  if (!accountId) {
    throw new Error('Failed to get account ID from accounts endpoint');
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      name: domain,
      account: { id: accountId },
      type: 'full',
    }),
  });

  const data = (await response.json()) as CloudflareZoneResponse;

  if (!response.ok || !data.success) {
    console.error('Cloudflare zone creation error:', data);
    throw new Error(
      data.errors?.[0]?.message || 'Failed to create Cloudflare zone'
    );
  }

  return data;
}

/**
 * Check the status of a Cloudflare zone
 */
export async function getCloudflareZoneStatus(
  zoneId: string,
  token: string
): Promise<CloudflareZoneStatusResponse> {
  if (!token) {
    throw new Error('Cloudflare API token is required');
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  const data = (await response.json()) as CloudflareZoneStatusResponse;

  if (!response.ok || !data.success) {
    console.error('Cloudflare zone status error:', data);
    throw new Error(
      data.errors?.[0]?.message || 'Failed to get zone status'
    );
  }

  return data;
}

/**
 * Deploy a WAF skip rule to a zone using the direct approach
 * This matches the curl command format exactly
 */
export async function deployWAFRule(
  zoneId: string,
  secretKey: string,
  token: string
): Promise<any> {
  if (!token) {
    throw new Error('Cloudflare API token is required');
  }

  const rule = {
    description: 'Bypass Bot Fight Mode with Password',
    expression: `(http.request.headers["X-Bot-Auth"] eq "${secretKey}")`,
    action: 'skip',
    action_parameters: {
      phases: ['http_request_sbfm'],
    },
    enabled: true,
  };

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/rules`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(rule),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    console.error('Cloudflare WAF skip rule deployment error:', data);
    throw new Error(
      data.errors?.[0]?.message || 'Failed to deploy WAF skip rule'
    );
  }

  return data;
}
