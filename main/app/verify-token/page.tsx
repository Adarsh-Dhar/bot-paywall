/**
 * Token Verification Page
 * Displays Cloudflare token verification and zone lookup interface
 */

import CloudflareTokenVerification from '@/components/CloudflareTokenVerification';

export default function VerifyTokenPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Cloudflare Token Verification</h1>
          <p className="text-slate-600 mt-2">
            Verify your API token and lookup zone IDs for WAF rule deployment
          </p>
        </div>

        {/* Main Content */}
        <CloudflareTokenVerification />

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Need help? Check the{' '}
            <a 
              href="https://developers.cloudflare.com/fundamentals/api/get-started/create-token/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Cloudflare API documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}