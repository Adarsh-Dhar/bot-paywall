// Test script to verify human access works correctly
const testUrl = 'https://test-cloudflare-website.adarsh.software/';

// Test 1: Simulate a real browser request (should NOT trigger paywall)
async function testHumanBrowser() {
  console.log('🧑 Testing human browser access...');
  
  const response = await fetch(testUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
  if (response.status === 402) {
    console.log('❌ FAILED: Human browser got 402 payment required');
    const body = await response.text();
    console.log('Response body:', body);
  } else {
    console.log('✅ SUCCESS: Human browser access allowed');
  }
  
  return response.status !== 402;
}

// Test 2: Simulate a bot request (should trigger paywall)
async function testBot() {
  console.log('\n🤖 Testing bot access...');
  
  const response = await fetch(testUrl, {
    headers: {
      'User-Agent': 'python-requests/2.28.1',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate'
    }
  });
  
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
  if (response.status === 402) {
    console.log('✅ SUCCESS: Bot got 402 payment required');
    const body = await response.text();
    console.log('Payment details:', JSON.parse(body));
  } else {
    console.log('❌ FAILED: Bot access was allowed');
  }
  
  return response.status === 402;
}

// Run tests
async function runTests() {
  console.log('Testing Cloudflare Worker Bot Detection\n');
  
  const humanTest = await testHumanBrowser();
  const botTest = await testBot();
  
  console.log('\n📊 Test Results:');
  console.log(`Human access: ${humanTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Bot blocking: ${botTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (humanTest && botTest) {
    console.log('\n🎉 All tests passed! Bot detection is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
}

runTests().catch(console.error);