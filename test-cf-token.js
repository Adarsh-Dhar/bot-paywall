#!/usr/bin/env node
/**
 * Test script to verify Cloudflare API token
 */

import fetch from 'node-fetch';
import 'dotenv/config';

const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_TOKEN;
const CLOUDFLARE_TOKEN_MAIN = 'EMxSKr25M4-bsxyAZo41mHFaohfUpPy4gLaLpt4Q'; // From main/.env
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

console.log('Testing Cloudflare API Tokens');
console.log('============================');
console.log(`Token (root .env): ${CLOUDFLARE_TOKEN?.substring(0, 8)}... (length: ${CLOUDFLARE_TOKEN?.length})`);
console.log(`Token (main .env): ${CLOUDFLARE_TOKEN_MAIN?.substring(0, 8)}... (length: ${CLOUDFLARE_TOKEN_MAIN?.length})`);
console.log(`Zone ID: ${CLOUDFLARE_ZONE_ID}`);

async function testToken(tokenName, token) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${tokenName}`);
  console.log(`${'='.repeat(50)}`);

  try {
    // Test 1: Verify token
    console.log('\n1. Verifying token...');
    const verifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const verifyData = await verifyResponse.json();
    console.log('Token verification:', JSON.stringify(verifyData, null, 2));

    if (!verifyData.success) {
      console.log('⚠️ Token is invalid, skipping further tests');
      return false;
    }

    // Test 2: Get zone details
    console.log('\n2. Getting zone details...');
    const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const zoneData = await zoneResponse.json();
    console.log('Zone details:', JSON.stringify(zoneData, null, 2));

    // Test 3: List firewall access rules
    console.log('\n3. Testing firewall access rules permission...');
    const firewallResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/firewall/access_rules/rules`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const firewallData = await firewallResponse.json();
    console.log('Firewall access rules:', JSON.stringify(firewallData, null, 2));

    return firewallData.success;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function main() {
  // Test root .env token
  const rootTokenWorks = await testToken('Root .env CLOUDFLARE_TOKEN', CLOUDFLARE_TOKEN);

  // Test main .env token
  const mainTokenWorks = await testToken('Main .env CLOUDFLARE_API_TOKEN', CLOUDFLARE_TOKEN_MAIN);

  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`Root .env token: ${rootTokenWorks ? '✅ WORKS' : '❌ INVALID'}`);
  console.log(`Main .env token: ${mainTokenWorks ? '✅ WORKS' : '❌ INVALID'}`);

  if (!rootTokenWorks && !mainTokenWorks) {
    console.log('\n⚠️ BOTH TOKENS ARE INVALID!');
    console.log('You need to create a new Cloudflare API token with these permissions:');
    console.log('  - Zone:Zone Settings:Read');
    console.log('  - Zone:Firewall Services:Edit');
    console.log('Go to: https://dash.cloudflare.com/profile/api-tokens');
  }
}

main();

