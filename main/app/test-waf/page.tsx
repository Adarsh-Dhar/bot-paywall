'use client';

import { useState } from 'react';
import { deployWAFRule } from '@/app/actions/deploy-waf-rule';

export default function TestWAFPage() {
  const [zoneId, setZoneId] = useState('');
  const [token, setToken] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const testWAFDeployment = async () => {
    if (!zoneId || !token || !secretKey) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-waf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zoneId,
          token,
          secretKey,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        error: 'Request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCurlCommand = () => {
    if (!zoneId || !token || !secretKey) return '';

    return `curl -X POST "https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/rules" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  --data '{
    "description": "Bypass Bot Fight Mode with Password",
    "expression": "(http.request.headers[\\"X-Bot-Auth\\"] eq \\"${secretKey}\\")",
    "action": "skip",
    "action_parameters": {
      "phases": ["http_request_sbfm"]
    },
    "enabled": true
  }'`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Test WAF Rule Deployment</h1>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Test Parameters</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Zone ID
              </label>
              <input
                type="text"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                placeholder="11685346bf13dc3ffebc9cc2866a8105"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Cloudflare API Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="oWN3t2VfMulCIBh7BzrScK87xlKmPRp6a1ttKVsB"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Secret Key (Gatekeeper Token)
              </label>
              <input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="MySuperSecretPassword123"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={testWAFDeployment}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Testing...' : 'Test WAF Rule Deployment'}
            </button>
          </div>
        </div>

        {/* Generated Curl Command */}
        {zoneId && token && secretKey && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Generated Curl Command</h2>
            <pre className="bg-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
              {generateCurlCommand()}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(generateCurlCommand())}
              className="mt-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
            >
              Copy Curl Command
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Result</h2>
            <pre className={`p-4 rounded-lg text-sm overflow-x-auto ${
              result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Instructions</h3>
          <ol className="text-blue-700 space-y-2 text-sm">
            <li>1. Enter your Cloudflare Zone ID (found in your Cloudflare dashboard)</li>
            <li>2. Enter your Cloudflare API Token (with Zone:Edit permissions)</li>
            <li>3. Enter a secret key that bots will use to bypass protection</li>
            <li>4. Click &quot;Test WAF Rule Deployment&quot; to deploy the rule</li>
            <li>5. Once deployed, bots can use the X-Bot-Auth header with your secret key</li>
          </ol>
        </div>

        {/* Bot Usage Example */}
        {secretKey && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Bot Usage Example</h3>
            <p className="text-green-700 text-sm mb-3">
              Once the rule is deployed, bots can bypass protection like this:
            </p>
            <pre className="bg-green-100 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "https://yourdomain.com/api/data" \\
  -H "X-Bot-Auth: ${secretKey}" \\
  -H "User-Agent: MyBot/1.0"`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}