'use client';

/**
 * Integration Example Component
 * Shows how to use the X-Partner-Key header to bypass bot protection
 * Requirements: 5.4, 5.5
 */

import { useState } from 'react';

interface IntegrationExampleProps {
  domain: string;
  secretKey: string;
}

export default function IntegrationExample({ domain, secretKey }: IntegrationExampleProps) {
  const [copied, setCopied] = useState(false);

  const integrationCode = `// Example: Bypass bot protection with X-Partner-Key header
curl -X GET "https://${domain}/api/data" \\
  -H "X-Partner-Key: ${secretKey}" \\
  -H "Content-Type: application/json"

// JavaScript/Node.js example
const response = await fetch('https://${domain}/api/data', {
  method: 'GET',
  headers: {
    'X-Partner-Key': '${secretKey}',
    'Content-Type': 'application/json'
  }
});

// Python example
import requests

response = requests.get(
    'https://${domain}/api/data',
    headers={
        'X-Partner-Key': '${secretKey}',
        'Content-Type': 'application/json'
    }
)`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(integrationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Integration Code</h3>
          <p className="text-sm text-slate-600">
            Use the X-Partner-Key header to bypass bot protection
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      
      <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
        <pre className="text-sm text-slate-100 whitespace-pre-wrap">
          <code>{integrationCode}</code>
        </pre>
      </div>
      
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">How it works</h4>
            <p className="mt-1 text-sm text-blue-700">
              When you include the X-Partner-Key header with your secret key, Cloudflare&apos;s WAF skip rule
              will bypass Super Bot Fight Mode and Rate Limiting, allowing your requests through without challenges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}