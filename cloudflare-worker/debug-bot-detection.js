// Debug bot detection
const testUrl = 'https://test-cloudflare-website.adarsh.software/';

// Test bot request
fetch(testUrl, {
  headers: {
    'User-Agent': 'python-requests/2.28.1',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate'
  }
}).then(response => {
  console.log('Bot test - Status:', response.status);
  console.log('Bot test - Headers:', Object.fromEntries(response.headers.entries()));
  
  if (response.status === 402) {
    return response.text().then(body => {
      console.log('Bot test - Payment required (correct):', body);
    });
  } else {
    console.log('Bot test - Access allowed (incorrect)');
  }
}).catch(console.error);