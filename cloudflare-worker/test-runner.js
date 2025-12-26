// Simple test runner to exercise the worker logic using the CJS backup
const http = require('http');
const worker = require('./paywall-worker-cjs.js.backup');

// Minimal Request/Response polyfill for the worker.fetch function
const { Request, Headers } = require('node-fetch');

async function runTests() {
  const botReq = new Request('https://test-cloudflare-website.adarsh.software/some/path', {
    method: 'GET',
    headers: new Headers({
      'User-Agent': 'curl/7.90',
      'Host': 'test-cloudflare-website.adarsh.software'
    })
  });

  const humanReq = new Request('https://test-cloudflare-website.adarsh.software/', {
    method: 'GET',
    headers: new Headers({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/100.0',
      'Accept': 'text/html',
      'Host': 'test-cloudflare-website.adarsh.software'
    })
  });

  console.log('Running bot request...');
  const botResp = await worker.fetch(botReq, {});
  console.log('BOT status:', botResp.status);
  console.log('BOT body:', await botResp.text());

  console.log('Running human request...');
  const humanResp = await worker.fetch(humanReq, {});
  console.log('HUMAN status:', humanResp.status);
  console.log('HUMAN body (truncated):', (await humanResp.text()).slice(0,200));
}

runTests().catch(e => {
  console.error('Error running tests:', e);
  process.exit(1);
});

