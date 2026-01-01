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
      // Save the project with gatekeeper_secret (no domain parameter)
      const saveResult = await saveProjectWithToken(
        validatedUrl,
        projectApiToken.trim(),
        selectedZone.id,
        selectedZone.nameservers,
        secret
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#f5c518]/20 border-t-[#f5c518] mx-auto" />
          <div className="text-zinc-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Connect Your Cloudflare Account
          </h1>
          <p className="text-zinc-400">
            {step === 'project' && 'Set up your website project with Cloudflare integration'}
            {step === 'complete' && 'Setup complete! Your domain is ready for protection'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              step === 'project' ? 'border-[#f5c518] bg-[#f5c518]/20 text-[#f5c518]' : 
              'border-emerald-400 bg-emerald-400/20 text-emerald-400'
            }`}>
              {step === 'project' ? '1' : '✓'}
            </div>
            <div className={`w-16 h-0.5 ${step === 'project' ? 'bg-zinc-600' : 'bg-emerald-400'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              step === 'complete' ? 'border-[#f5c518] bg-[#f5c518]/20 text-[#f5c518]' : 
              'border-zinc-600 bg-zinc-800 text-zinc-400'
            }`}>
              2
            </div>
          </div>
        </div>

        {/* Existing Token Info */}
        {existingToken && step !== 'token' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-emerald-300 mb-2">
                  ✓ Connected to Cloudflare
                </h3>
                <div className="space-y-1 text-sm text-emerald-200">
                  <p><strong>Token Name:</strong> {existingToken.tokenName || 'N/A'}</p>
                  <p><strong>Account ID:</strong> {existingToken.accountId || 'N/A'}</p>
                  <p><strong>Last Verified:</strong> {existingToken.lastVerified ? new Date(existingToken.lastVerified).toLocaleString() : 'Never'}</p>
                </div>
              </div>
              <button
                onClick={handleRemoveToken}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
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
            <div className="bg-white/5 rounded-lg border border-white/10 p-6 mb-8 backdrop-blur">
              <h2 className="text-xl font-semibold text-white mb-4">
                Step 1: Create a Cloudflare API Token
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-zinc-300 mb-2">
                      Click the button below to open Cloudflare&apos;s API token creation page:
                    </p>
                    <a
                      href="https://dash.cloudflare.com/profile/api-tokens/create"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-md hover:bg-[#f5c518]/30 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Create API Token
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-zinc-300 mb-2">
                      Select <strong>&quot;Create Custom Token&quot;</strong> and configure these <strong>minimum required</strong> permissions:
                    </p>
                    <div className="bg-black/30 rounded-md p-4 space-y-2 text-sm font-mono">
                      <div className="flex items-center">
                        <span className="text-zinc-400 w-32">Zone</span>
                        <span className="text-zinc-500 mx-2">→</span>
                        <span className="text-zinc-300">Zone</span>
                        <span className="text-zinc-500 mx-2">→</span>
                        <span className="text-emerald-400 font-semibold">Read</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-zinc-400 w-32">Zone</span>
                        <span className="text-zinc-500 mx-2">→</span>
                        <span className="text-zinc-300">Firewall Services</span>
                        <span className="text-zinc-500 mx-2">→</span>
                        <span className="text-emerald-400 font-semibold">Edit</span>
                      </div>
                    </div>
                    <p className="text-zinc-400 text-sm mt-2">
                      Note: Make sure &quot;Zone Resources&quot; is set to <strong>&quot;Include → All zones&quot;</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#f5c518]/20 text-[#f5c518] rounded-full flex items-center justify-center font-semibold mr-3">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-zinc-300">
                      Copy the token and paste it below
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Input Form */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-6 backdrop-blur">
              <h2 className="text-xl font-semibold text-white mb-4">
                Paste Your API Token
              </h2>

              <form onSubmit={handleTokenSubmit} className="space-y-4">
                <div>
                  <label htmlFor="token" className="block text-sm font-medium text-white mb-2">
                    Cloudflare API Token
                  </label>
                  <input
                    type="password"
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="PP_Dqm0PpxVpPzxUpEmXGswskREXy4fTeA48pcPPso"
                    className="w-full px-4 py-2 border border-white/20 bg-white/5 text-white rounded-md focus:ring-2 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/60 placeholder-zinc-500"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Your token is encrypted and stored securely. We never share it with anyone.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-4">
                    <p className="text-sm text-emerald-300">
                      ✓ Token saved successfully! Moving to domain verification...
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading || !token.trim()}
                    className="flex-1 px-6 py-3 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-md hover:bg-[#f5c518]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? 'Verifying...' : 'Connect Cloudflare'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-white/10 text-zinc-300 rounded-md hover:bg-white/20 transition-colors"
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
          <div className="bg-white/5 rounded-lg border border-white/10 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold text-white mb-4">
              Create New Project
            </h2>
            <p className="text-zinc-400 mb-6">
              Enter your website details and Cloudflare credentials to configure protection.
            </p>

            <form onSubmit={handleProjectSubmit} className="space-y-6">
              {/* Website URL */}
              <div>
                <label htmlFor="websiteUrl" className="block text-sm font-medium text-white mb-2">
                  Website URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 text-white rounded-md focus:ring-2 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/60 placeholder-zinc-500"
                  disabled={lookingUpZone}
                />
                <p className="mt-1 text-xs text-zinc-400">
                  The full URL of the website you want to protect
                </p>
              </div>



              {/* API Token */}
              <div>
                <label htmlFor="projectApiToken" className="block text-sm font-medium text-white mb-2">
                  Cloudflare API Token <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  id="projectApiToken"
                  value={projectApiToken}
                  onChange={(e) => setProjectApiToken(e.target.value)}
                  placeholder="Enter your Cloudflare API token"
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 text-white rounded-md focus:ring-2 focus:ring-[#f5c518]/40 focus:border-[#f5c518]/60 placeholder-zinc-500"
                  disabled={lookingUpZone}
                />
                <p className="mt-1 text-xs text-zinc-400">
                  A Cloudflare API token with Zone:Read and Zone:Edit permissions.{' '}
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f5c518] hover:underline"
                  >
                    Create one here
                  </a>
                </p>
              </div>

              {/* Zone ID Display */}
              <div className="border-t border-white/10 pt-4">
                <label className="block text-sm font-medium text-white mb-3">
                  Zone ID <span className="text-red-400">*</span>
                </label>
                {fetchingZones ? (
                  <div className="flex items-center gap-2 text-blue-300">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300/20 border-t-blue-300" />
                    Fetching zone ID...
                  </div>
                ) : zoneId ? (
                  <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-md p-3">
                    <p className="text-sm text-blue-300">
                      <strong>Zone ID:</strong>{' '}
                      <code className="bg-black/30 px-2 py-1 rounded text-xs">{zoneId}</code>
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-red-400">No zone ID found for this API token.</div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={
                    lookingUpZone ||
                    !websiteUrl.trim() ||
                    !projectApiToken.trim() ||
                    !zoneId
                  }
                  className="flex-1 px-6 py-3 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-md hover:bg-[#f5c518]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {lookingUpZone ? 'Creating Project...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-white/10 text-zinc-300 rounded-md hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && zoneResult && (
          <div className="bg-white/5 rounded-lg border border-white/10 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold text-white mb-4">
              🎉 Setup Complete!
            </h2>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-emerald-300 mb-4">
                ✓ Project Created Successfully
              </h3>
              
              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium text-emerald-200 mb-2">Gatekeeper Secret:</p>
                                  {gatekeeperSecret ? (
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-xs font-mono bg-black/30 border border-emerald-400/30 px-3 py-2 rounded text-emerald-100">
                                        {gatekeeperSecret}
                                      </code>
                                      <button
                                        onClick={() => copyToClipboard(gatekeeperSecret)}
                                        className="p-2 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/20 rounded transition-colors"
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
                    <p className="text-sm font-medium text-emerald-200 mb-1">Website URL:</p>
                    <p className="text-emerald-100 font-mono">{websiteUrl}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-200 mb-1">Status:</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      zoneResult.status === 'active' 
                        ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' 
                        : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                    }`}>
                      {zoneResult.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-emerald-200 mb-2">Zone ID:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-black/30 border border-emerald-400/30 px-3 py-2 rounded text-emerald-100">
                      {zoneResult.zoneId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(zoneResult.zoneId!)}
                      className="p-2 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/20 rounded transition-colors"
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
                    <p className="text-sm font-medium text-emerald-200 mb-2">Nameservers:</p>
                    <div className="space-y-1">
                      {zoneResult.nameservers.map((ns, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-black/30 border border-emerald-400/30 px-3 py-2 rounded text-emerald-100">
                            {ns}
                          </code>
                          <button
                            onClick={() => copyToClipboard(ns)}
                            className="p-2 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/20 rounded transition-colors"
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

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">What's Next?</h4>
              <p className="text-sm text-blue-200">
                Your project is now configured. You can now deploy WAF skip rules to protect your domain while allowing authorized access.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                className="flex-1 px-6 py-3 bg-[#f5c518]/20 border border-[#f5c518]/40 text-[#f5c518] rounded-md hover:bg-[#f5c518]/30 transition-colors font-medium"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => router.push('/verify-token')}
                className="px-6 py-3 bg-white/10 text-zinc-300 rounded-md hover:bg-white/20 transition-colors"
              >
                Advanced Verification
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-300 mb-1">Security & Privacy</h3>
              <p className="text-sm text-blue-200">
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