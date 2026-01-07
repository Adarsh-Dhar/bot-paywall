'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveCloudflareToken,
  getUserCloudflareTokenInfo,
  removeCloudflareToken,
  type UserCloudflareToken,
} from '@/app/actions/cloudflare-tokens';
import { lookupZoneId, saveDomainToDatabase, getZonesForToken, type ZoneLookupResult, type ZoneInfo } from '@/app/actions/cloudflare-token-verification';
import { getZonesWithProvidedToken, saveProjectWithToken } from '@/app/actions/cloudflare-project';

export default function ConnectCloudflarePage() {
    // State to hold the generated gatekeeper secret for display
    const [gatekeeperSecret, setGatekeeperSecret] = useState<string | null>(null);
  const router = useRouter();
  const [token, setToken] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  // ...existing code...
  const [projectApiToken, setProjectApiToken] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [paymentAddress, setPaymentAddress] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookingUpZone, setLookingUpZone] = useState(false);
  const [fetchingZones, setFetchingZones] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingToken, setExistingToken] = useState<UserCloudflareToken | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [zoneResult, setZoneResult] = useState<ZoneLookupResult | null>(null);
  const [availableZones, setAvailableZones] = useState<ZoneInfo[]>([]);
  const [step, setStep] = useState<'token' | 'project' | 'complete'>('project');

  const loadTokenInfo = useCallback(async () => {
    setLoadingInfo(true);
    const info = await getUserCloudflareTokenInfo();
    setExistingToken(info);

    // If token exists, start at project step and fetch zones
    if (info) {
      setStep('project');
      fetchAvailableZones();
    }

    setLoadingInfo(false);
  }, []);

  useEffect(() => {
    void loadTokenInfo();
  }, [loadTokenInfo]);

  async function fetchAvailableZones() {
    setFetchingZones(true);
    try {
      const result = await getZonesForToken();
      if (result.success && result.zones) {
        setAvailableZones(result.zones);
      } else {
        setError(result.message || 'Failed to fetch zones');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zones');
    } finally {
      setFetchingZones(false);
    }
  }

  async function fetchZoneIdFromToken(token: string) {
    setFetchingZones(true);
    setError(null);
    try {
      const result = await getZonesWithProvidedToken(token);
      if (result.success && result.zones && result.zones.length > 0) {
        setZoneId(result.zones[0].id);
        setAvailableZones(result.zones);
      } else {
        setError(result.message || 'Failed to fetch zone ID');
        setZoneId('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zone ID');
      setZoneId('');
    } finally {
      setFetchingZones(false);
    }
  }

  async function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Clean the token input - remove whitespace and invisible characters
    const cleanedToken = token.trim().replace(/[\r\n\t\s]+/g, '');

    if (!cleanedToken) {
      setError('Please enter your Cloudflare API token');
      return;
    }

    // Basic token format validation - Cloudflare tokens are typically 40+ characters
    if (cleanedToken.length < 20) {
      setError('Token appears too short. Please enter a valid Cloudflare API token.');
      return;
    }

    // Validate token contains only valid characters
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanedToken)) {
      setError('Token contains invalid characters. Please copy the token exactly from Cloudflare without any extra spaces or line breaks.');
      return;
    }

    try {
      setLoading(true);
      const result = await saveCloudflareToken(cleanedToken);

      if (!result.success) {
        setError(result.error || 'Failed to save token');
        return;
      }

      setSuccess(true);
      await loadTokenInfo();
      
      // Move to project step and fetch zones
      setStep('project');
      await fetchAvailableZones();
    } catch (err) {
      // Handle specific error types
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      if (errorMessage.includes('Invalid request headers') || errorMessage.includes('header')) {
        setError('Token contains invalid characters. Please copy the token exactly from Cloudflare and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectApiToken.trim()) {
      fetchZoneIdFromToken(projectApiToken.trim());
    } else {
      setZoneId('');
      setAvailableZones([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectApiToken]);

  async function handleProjectSubmit(e: React.FormEvent) {
        // Helper to generate a random 32-character string
        function generateGatekeeperSecret() {
          const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        }
    e.preventDefault();
    setError(null);


    if (!websiteUrl.trim()) {
      setError('Please enter the website URL');
      return;
    }
    if (!projectApiToken.trim()) {
      setError('Please enter the Cloudflare API token for this project');
      return;
    }

    // Use a single validatedUrl variable for all logic
    let validatedUrl = websiteUrl.trim();
    if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
      validatedUrl = 'https://' + validatedUrl;
    }
    
    try {
      new URL(validatedUrl);
    } catch {
      setError('Please enter a valid website URL');
      return;
    }

    // Use the fetched zone ID only
    if (!zoneId) {
      setError('Zone ID could not be determined from the API token.');
      return;
    }
    // Validate zone ID format
    if (!/^[a-f0-9]{32}$/i.test(zoneId)) {
      setError('Invalid Zone ID format. Should be 32 hexadecimal characters.');
      return;
    }

    try {
      setLookingUpZone(true);

      // If using manual zone ID, we need to get zone info from Cloudflare
      const selectedZone = availableZones.find(z => z.id === zoneId);
      if (!selectedZone) {
        setError('Zone not found for the provided API token.');
        return;
      }

      setZoneResult({
        success: true,
        zoneId: selectedZone.id,
        zoneName: selectedZone.name,
        status: selectedZone.status,
        nameservers: selectedZone.nameservers,
        message: `Zone found: ${selectedZone.name}`,
      });
      // Generate a unique gatekeeper_secret for this domain
      const secret = generateGatekeeperSecret();
      // Save the project with gatekeeper_secret and payment info
      const saveResult = await saveProjectWithToken(
        validatedUrl,
        projectApiToken.trim(),
        selectedZone.id,
        selectedZone.nameservers,
        secret,
        paymentAddress.trim() || undefined,
        paymentAmount.trim() || undefined
      );
      // Store the secret in state for display
      setGatekeeperSecret(secret);

      if (!saveResult.success) {
        setError(saveResult.message || 'Failed to save project to database');
        return;
      }

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLookingUpZone(false);
    }
  }

  function handleComplete() {
    router.push('/');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  async function handleRemoveToken() {
    if (!confirm('Are you sure you want to disconnect your Cloudflare account?')) {
      return;
    }

    setLoading(true);
    const result = await removeCloudflareToken();

    if (result.success) {
      setExistingToken(null);
      setSuccess(true);
      setStep('token');
      setAvailableZones([]);
    } else {
      setError(result.error || 'Failed to remove token');
    }
    setLoading(false);
  }

  // Website URL change handler (no domain auto-fill)
  function handleWebsiteUrlChange(url: string) {
    setWebsiteUrl(url);
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-yellow-400/20 border-t-yellow-400 mx-auto" />
          <div className="text-gray-600 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            Connect Cloudflare
          </h1>
          <p className="text-lg text-gray-600">
            {step === 'project' && 'Set up your website project with Cloudflare integration'}
            {step === 'complete' && 'Setup complete! Your domain is ready for protection'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold ${
              step === 'project' ? 'border-yellow-400 bg-yellow-400 text-gray-900' : 
              'border-yellow-400 bg-yellow-400 text-gray-900'
            }`}>
              {step === 'project' ? '1' : '✓'}
            </div>
            <div className={`w-20 h-1 ${step === 'project' ? 'bg-gray-300' : 'bg-yellow-400'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold ${
              step === 'complete' ? 'border-yellow-400 bg-yellow-400 text-gray-900' : 
              'border-gray-300 bg-gray-100 text-gray-400'
            }`}>
              2
            </div>
          </div>
        </div>

        {/* Existing Token Info */}
        {existingToken && step !== 'token' && (
          <div className="bg-yellow-100 border-2 border-yellow-300 rounded-2xl p-6 mb-8 shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-yellow-900 mb-3">
                  ✓ Connected to Cloudflare
                </h3>
                <div className="space-y-2 text-sm text-yellow-800">
                  <p><strong>Token Name:</strong> {existingToken.tokenName || 'N/A'}</p>
                  <p><strong>Account ID:</strong> {existingToken.accountId || 'N/A'}</p>
                  <p><strong>Last Verified:</strong> {existingToken.lastVerified ? new Date(existingToken.lastVerified).toLocaleString() : 'Never'}</p>
                </div>
              </div>
              <button
                onClick={handleRemoveToken}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-red-700 hover:text-red-900 hover:bg-red-100 border-2 border-red-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Token Setup */}
        {step === 'token' && (
          <>
            {/* Instructions */}
            <div className="bg-white rounded-2xl border-2 border-gray-300 p-8 mb-8 shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Step 1: Create a Cloudflare API Token
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-yellow-400 text-gray-900 rounded-full flex items-center justify-center font-bold mr-4">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-3 font-medium">
                      Click the button below to open Cloudflare&apos;s API token creation page:
                    </p>
                    <a
                      href="https://dash.cloudflare.com/profile/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-6 py-3 bg-yellow-400 border-2 border-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors font-bold shadow-md"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Create API Token
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-yellow-400 text-gray-900 rounded-full flex items-center justify-center font-bold mr-4">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-3 font-medium">
                      Select <strong>&quot;Create Custom Token&quot;</strong> and configure these <strong>minimum required</strong> permissions:
                    </p>
                    <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 space-y-2 text-sm font-mono">
                      <div className="flex items-center">
                        <span className="text-gray-600 w-32">Zone</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-gray-900 font-bold">Zone</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-yellow-700 font-bold">Read</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-gray-600 w-32">Zone</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-gray-900 font-bold">Firewall Services</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-yellow-700 font-bold">Edit</span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mt-3 font-medium">
                      Note: Make sure &quot;Zone Resources&quot; is set to <strong>&quot;Include → All zones&quot;</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-yellow-400 text-gray-900 rounded-full flex items-center justify-center font-bold mr-4">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 font-medium">
                      Copy the token and paste it below
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Input Form */}
            <div className="bg-white rounded-2xl border-2 border-gray-300 p-8 shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Paste Your API Token
              </h2>

              <form onSubmit={handleTokenSubmit} className="space-y-6">
                <div>
                  <label htmlFor="token" className="block text-sm font-bold text-gray-900 mb-2">
                    Cloudflare API Token
                  </label>
                  <input
                    type="password"
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso"
                    className="w-full px-4 py-3 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-200 focus:border-yellow-400 placeholder-gray-500"
                    disabled={loading}
                  />
                  <p className="mt-2 text-xs text-gray-600 font-medium">
                    Your token is encrypted and stored securely. We never share it with anyone.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-900">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4">
                    <p className="text-sm font-medium text-yellow-900">
                      ✓ Token saved successfully! Moving to domain verification...
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={loading || !token.trim()}
                    className="flex-1 px-8 py-3 bg-yellow-400 border-2 border-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                  >
                    {loading ? 'Verifying...' : 'Connect Cloudflare'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Step 2: Project Setup */}
        {step === 'project' && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-8 shadow-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Create New Project
            </h2>
            <p className="text-gray-600 mb-8 font-medium">
              Enter your website details and Cloudflare credentials to configure protection.
            </p>

            <form onSubmit={handleProjectSubmit} className="space-y-6">
              {/* Website URL */}
              <div>
                <label htmlFor="websiteUrl" className="block text-sm font-bold text-gray-900 mb-2">
                  Website URL <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-200 focus:border-yellow-400 placeholder-gray-500"
                  disabled={lookingUpZone}
                />
                <p className="mt-2 text-xs text-gray-600 font-medium">
                  The full URL of the website you want to protect
                </p>
              </div>



              {/* API Token */}
              <div>
                <label htmlFor="projectApiToken" className="block text-sm font-bold text-gray-900 mb-2">
                  Cloudflare API Token <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  id="projectApiToken"
                  value={projectApiToken}
                  onChange={(e) => setProjectApiToken(e.target.value)}
                  placeholder="Enter your Cloudflare API token"
                  className="w-full px-4 py-3 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-200 focus:border-yellow-400 placeholder-gray-500"
                  disabled={lookingUpZone}
                />
                <p className="mt-2 text-xs text-gray-600 font-medium">
                  A Cloudflare API token with Zone:Read and Zone:Edit permissions.{' '}
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-700 hover:text-yellow-900 font-bold"
                  >
                    Create one here
                  </a>
                </p>
              </div>

              {/* Zone ID Display */}
              <div className="border-t-2 border-gray-200 pt-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Zone ID <span className="text-red-600">*</span>
                </label>
                {fetchingZones ? (
                  <div className="flex items-center gap-2 text-yellow-700 font-medium">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-400/20 border-t-yellow-400" />
                    Fetching zone ID...
                  </div>
                ) : zoneId ? (
                  <div className="mt-3 bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4">
                    <p className="text-sm text-yellow-900 font-medium">
                      <strong>Zone ID:</strong>{' '}
                      <code className="bg-white border border-yellow-300 px-2 py-1 rounded text-xs">{zoneId}</code>
                    </p>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-red-600">No zone ID found for this API token.</div>
                )}
              </div>

              {/* Payment Address */}
              <div className="border-t-2 border-gray-200 pt-6">
                <label htmlFor="paymentAddress" className="block text-sm font-bold text-gray-900 mb-2">
                  Payment Address <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="paymentAddress"
                  value={paymentAddress}
                  onChange={(e) => setPaymentAddress(e.target.value)}
                  placeholder="0xea859ca79b267afdb7bd7702cd93c4e7c0db16ecaca862fb38c63d928f821a1b"
                  className="w-full px-4 py-3 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-200 focus:border-yellow-400 placeholder-gray-500 font-mono text-sm"
                  disabled={lookingUpZone}
                />
                <p className="mt-2 text-xs text-gray-600 font-medium">
                  The MOVE token address where payments will be sent. Leave empty to use default.
                </p>
              </div>

              {/* Payment Amount */}
              <div>
                <label htmlFor="paymentAmount" className="block text-sm font-bold text-gray-900 mb-2">
                  Payment Amount (in octas) <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="paymentAmount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="1000000"
                  className="w-full px-4 py-3 border-2 border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-200 focus:border-yellow-400 placeholder-gray-500 font-mono text-sm"
                  disabled={lookingUpZone}
                />
                <p className="mt-2 text-xs text-gray-600 font-medium">
                  The payment amount in octas (smallest unit). 1000000 octas = 0.01 MOVE. Leave empty to use default.
                </p>
              </div>

              {error && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900">{error}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={
                    lookingUpZone ||
                    !websiteUrl.trim() ||
                    !projectApiToken.trim() ||
                    !zoneId
                  }
                  className="flex-1 px-8 py-3 bg-yellow-400 border-2 border-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                >
                  {lookingUpZone ? 'Creating Project...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && zoneResult && (
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              🎉 Setup Complete!
            </h2>

            <div className="bg-yellow-100 border-2 border-yellow-300 rounded-2xl p-6 mb-8">
              <h3 className="text-xl font-bold text-yellow-900 mb-4">
                ✓ Project Created Successfully
              </h3>
              
              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-bold text-yellow-900 mb-2">Gatekeeper Secret:</p>
                                  {gatekeeperSecret ? (
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-xs font-mono bg-white border-2 border-yellow-300 px-3 py-2 rounded text-yellow-900">
                                        {gatekeeperSecret}
                                      </code>
                                      <button
                                        onClick={() => copyToClipboard(gatekeeperSecret)}
                                        className="p-2 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-200 rounded transition-colors"
                                        title="Copy Gatekeeper Secret"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-red-400">Secret not generated</span>
                                  )}
                                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-bold text-yellow-900 mb-1">Website URL:</p>
                    <p className="text-yellow-800 font-mono">{websiteUrl}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-yellow-900 mb-1">Status:</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      zoneResult.status === 'active' 
                        ? 'bg-yellow-200 text-yellow-900 border-2 border-yellow-400' 
                        : 'bg-orange-200 text-orange-900 border-2 border-orange-400'
                    }`}>
                      {zoneResult.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-yellow-900 mb-2">Zone ID:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-white border-2 border-yellow-300 px-3 py-2 rounded text-yellow-900">
                      {zoneResult.zoneId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(zoneResult.zoneId!)}
                      className="p-2 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-200 rounded transition-colors"
                      title="Copy Zone ID"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {zoneResult.nameservers && zoneResult.nameservers.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-yellow-900 mb-2">Nameservers:</p>
                    <div className="space-y-2">
                      {zoneResult.nameservers.map((ns, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-white border-2 border-yellow-300 px-3 py-2 rounded text-yellow-900">
                            {ns}
                          </code>
                          <button
                            onClick={() => copyToClipboard(ns)}
                            className="p-2 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-200 rounded transition-colors"
                            title="Copy Nameserver"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 mb-8">
              <h4 className="text-sm font-bold text-gray-900 mb-2">What's Next?</h4>
              <p className="text-sm text-gray-700 font-medium">
                Your project is now configured. You can now deploy WAF skip rules to protect your domain while allowing authorized access.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleComplete}
                className="flex-1 px-8 py-3 bg-yellow-400 border-2 border-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors font-bold shadow-md"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => router.push('/verify-token')}
                className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-bold"
              >
                Advanced Verification
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-8 bg-gray-100 border-2 border-gray-300 rounded-2xl p-6 shadow-md">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-yellow-600 mt-0.5 mr-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Security & Privacy</h3>
              <p className="text-sm text-gray-700 font-medium">
                Your API token is encrypted using AES-256-CBC encryption before being stored in our database. 
                We only use it to manage your domains and never share it with third parties. 
                You can disconnect at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}