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

function getHeaders(token?: string): HeadersInit {
  const apiToken = token || process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error('Cloudflare API token is required');
  }

  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a new Cloudflare zone for a domain
 */
export async function createCloudflareZone(
  domain: string,
  token?: string
): Promise<CloudflareZoneResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is not set');
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
  token?: string
): Promise<CloudflareZoneStatusResponse> {
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
  token?: string
): Promise<any> {
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
