#!/usr/bin/env node

/**
 * Test script to verify the whitelist creation and deletion flow
 * 
 * Usage: node test-whitelist-flow.js <domain> <ip>
 * Example: node test-whitelist-flow.js test-cloudflare-website.adarsh.software 1.2.3.4
 */

import fetch from 'node-fetch';

const ACCESS_SERVER_URL = process.env.ACCESS_SERVER_URL;
const TEST_DOMAIN = process.argv[2] || 'test-cloudflare-website.adarsh.software';
const TEST_IP = process.argv[3] || '192.168.1.100';

console.log('='.repeat(80));
console.log('🧪 WHITELIST FLOW TEST');
console.log('='.repeat(80));
console.log(`Access Server: ${ACCESS_SERVER_URL}`);
console.log(`Domain: ${TEST_DOMAIN}`);
console.log(`IP: ${TEST_IP}`);
console.log('='.repeat(80));
console.log('');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAccess(ip, domain) {
  try {
    const response = await fetch(`${ACCESS_SERVER_URL}/check-access/${ip}?domain=${encodeURIComponent(domain)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error checking access: ${error.message}`);
    return null;
  }
}

async function getDebugInfo() {
  try {
    const response = await fetch(`${ACCESS_SERVER_URL}/debug/cleanups`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error getting debug info: ${error.message}`);
    return null;
  }
}

async function testFlow() {
  console.log('📋 Step 1: Check initial state (IP should not be whitelisted)');
  console.log('-'.repeat(80));
  let status = await checkAccess(TEST_IP, TEST_DOMAIN);
  console.log('Status:', JSON.stringify(status, null, 2));
  
  if (status && status.whitelisted) {
    console.log('⚠️  IP is already whitelisted. This might affect the test.');
    console.log('   Attempting to revoke access first...');
    try {
      const revokeResponse = await fetch(
        `${ACCESS_SERVER_URL}/revoke-access/${TEST_IP}?domain=${encodeURIComponent(TEST_DOMAIN)}`,
        { method: 'DELETE' }
      );
      const revokeData = await revokeResponse.json();
      console.log('Revoke result:', JSON.stringify(revokeData, null, 2));
      await sleep(2000); // Wait a bit for Cloudflare to process
    } catch (error) {
      console.error(`❌ Error revoking access: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('📋 Step 2: Check debug info (scheduled cleanups)');
  console.log('-'.repeat(80));
  let debugInfo = await getDebugInfo();
  console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
  
  console.log('');
  console.log('📋 Step 3: Simulate whitelisting (without payment)');
  console.log('-'.repeat(80));
  console.log('⚠️  Note: This test requires a valid payment transaction hash.');
  console.log('   For a full test, you would need to:');
  console.log('   1. Make a payment transaction');
  console.log('   2. Call /buy-access with the tx_hash');
  console.log('   3. Verify the IP is whitelisted');
  console.log('   4. Wait 60+ seconds');
  console.log('   5. Verify the IP is no longer whitelisted');
  console.log('');
  console.log('📋 Step 4: Monitor scheduled cleanups');
  console.log('-'.repeat(80));
  console.log('Checking scheduled cleanups every 10 seconds for 70 seconds...');
  console.log('');
  
  for (let i = 0; i < 7; i++) {
    await sleep(10000); // Wait 10 seconds
    const elapsed = (i + 1) * 10;
    console.log(`⏱️  ${elapsed} seconds elapsed`);
    
    debugInfo = await getDebugInfo();
    if (debugInfo) {
      console.log(`   Active cleanups: ${debugInfo.active_cleanups}`);
      if (debugInfo.cleanups && debugInfo.cleanups.length > 0) {
        console.log(`   Scheduled rules: ${debugInfo.cleanups.map(c => c.ruleId).join(', ')}`);
      }
    }
    
    // Check if IP is still whitelisted
    status = await checkAccess(TEST_IP, TEST_DOMAIN);
    if (status) {
      console.log(`   IP whitelisted: ${status.whitelisted ? '✅ YES' : '❌ NO'}`);
    }
    console.log('');
  }
  
  console.log('📋 Step 5: Final verification');
  console.log('-'.repeat(80));
  status = await checkAccess(TEST_IP, TEST_DOMAIN);
  console.log('Final status:', JSON.stringify(status, null, 2));
  
  debugInfo = await getDebugInfo();
  console.log('Final debug info:', JSON.stringify(debugInfo, null, 2));
  
  if (status && !status.whitelisted) {
    console.log('');
    console.log('✅ TEST PASSED: IP was successfully removed from whitelist');
  } else if (status && status.whitelisted) {
    console.log('');
    console.log('❌ TEST FAILED: IP is still whitelisted after 60+ seconds');
    console.log('   The deletion timer may not be working correctly.');
  } else {
    console.log('');
    console.log('⚠️  TEST INCONCLUSIVE: Could not verify final state');
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('🧪 TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run the test
testFlow().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});

