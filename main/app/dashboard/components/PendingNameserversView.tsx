'use client';

/**
 * PendingNameserversView Component
 * Displays nameservers and instructions for domain setup
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { useState } from 'react';
import { Project } from '@prisma/client';

interface PendingNameserversViewProps {
  project: Project;
  onVerify: () => Promise<void>;
  isVerifying: boolean;
}

export function PendingNameserversView({
  project,
  onVerify,
  isVerifying,
}: PendingNameserversViewProps) {
  const [copied, setCopied] = useState(false);

  const nameserversText = project.nameservers?.join('\n') || '';

  function copyToClipboard() {
    navigator.clipboard.writeText(nameserversText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Warning Banner */}
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-yellow-900">Action Required</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Your domain is not yet pointing to Cloudflare. Update your nameservers to activate protection.
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 border border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{project.name}</h1>
          <p className="text-slate-600 mb-8">Complete the setup to activate protection</p>

          {/* Nameservers Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Step 1: Update Nameservers</h2>
            <p className="text-slate-600 mb-4">
              Copy these nameservers and update them in your domain registrar (GoDaddy, Namecheap, etc.):
            </p>

            {/* Nameservers Display */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-4 font-mono text-sm">
              {project.nameservers && project.nameservers.length > 0 ? (
                <div className="space-y-2">
                  {project.nameservers.map((ns, index) => (
                    <div key={index} className="text-slate-900">
                      {ns}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">No nameservers available</div>
              )}
            </div>

            {/* Copy Button */}
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? 'Copied!' : 'Copy Nameservers'}
            </button>
          </div>

          {/* Instructions Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Step 2: Update Your Registrar</h2>
            <ol className="space-y-3 text-slate-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                <span>Log in to your domain registrar account</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                <span>Find the DNS or Nameserver settings for your domain</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                <span>Replace the existing nameservers with the ones above</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                <span>Save your changes (this may take 24-48 hours to propagate)</span>
              </li>
            </ol>
          </div>

          {/* Verification Section */}
          <div className="border-t border-slate-200 pt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Step 3: Verify & Activate</h2>
            <p className="text-slate-600 mb-6">
              Once you've updated your nameservers, click the button below to verify and activate protection:
            </p>
            <button
              onClick={onVerify}
              disabled={isVerifying}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isVerifying ? 'Verifying...' : 'I have updated them, Verify Now'}
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Nameserver changes can take up to 48 hours to propagate globally. If verification fails, please wait a bit longer and try again.
          </p>
        </div>
      </div>
    </div>
  );
}
