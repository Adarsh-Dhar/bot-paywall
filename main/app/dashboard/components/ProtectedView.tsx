'use client';

/**
 * ProtectedView Component
 * Displays protected project with secret key and integration snippet
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useState } from 'react';
import { Project } from '@/types/gatekeeper';
import { obscureSecretKey } from '@/lib/secret-key-generator';

interface ProtectedViewProps {
  project: Project;
}

export function ProtectedView({ project }: ProtectedViewProps) {
  const [showFullKey, setShowFullKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const obscuredKey = obscureSecretKey(project.secret_key);
  const displayKey = showFullKey ? project.secret_key : obscuredKey;

  const curlCommand = `curl -H "x-bot-password: ${project.secret_key}" https://${project.name}/api/data`;

  function copySecretKey() {
    navigator.clipboard.writeText(project.secret_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function copySnippet() {
    navigator.clipboard.writeText(curlCommand);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Success Banner */}
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Site is Live & Secure</h3>
            <p className="text-sm text-green-800 mt-1">
              Your domain is now protected with Gatekeeper bot firewall.
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 border border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{project.name}</h1>
          <p className="text-slate-600 mb-8">Protected with Gatekeeper</p>

          {/* Secret Key Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Backdoor Password</h2>
            <p className="text-slate-600 mb-4">
              Use this password to bypass bot detection for authenticated requests:
            </p>

            {/* Secret Key Display */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
              <code className="font-mono text-sm text-slate-900 break-all">{displayKey}</code>
              <button
                onClick={() => setShowFullKey(!showFullKey)}
                className="ml-4 flex-shrink-0 px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
              >
                {showFullKey ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={copySecretKey}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copiedKey ? 'Copied!' : 'Copy Password'}
            </button>
          </div>

          {/* Integration Section */}
          <div className="border-t border-slate-200 pt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Integration Example</h2>
            <p className="text-slate-600 mb-4">
              Include the <code className="bg-slate-100 px-2 py-1 rounded text-sm">x-bot-password</code> header in your requests to bypass bot detection:
            </p>

            {/* Code Snippet */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 mb-4 overflow-x-auto">
              <pre className="font-mono text-sm">{curlCommand}</pre>
            </div>

            {/* Copy Snippet Button */}
            <button
              onClick={copySnippet}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copiedSnippet ? 'Copied!' : 'Copy Snippet'}
            </button>
          </div>

          {/* Info Section */}
          <div className="border-t border-slate-200 mt-8 pt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">How It Works</h2>
            <ul className="space-y-3 text-slate-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                <span>Bots are detected using Cloudflare's bot detection and user agent analysis</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                <span>Requests without the correct password are challenged with a CAPTCHA</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                <span>Requests with the correct password bypass the challenge</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                <span>Real users can always solve the CAPTCHA to proceed</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Security Note:</strong> Keep your backdoor password secure. Only share it with trusted applications that need to bypass bot detection.
          </p>
        </div>
      </div>
    </div>
  );
}
