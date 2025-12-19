'use client';

import { useState, useEffect } from 'react';
import { registerDomain, getUserProjects, deploySkipRule, type ProjectWithToken } from '@/app/actions/gatekeeper';
import { checkCloudflareConnection } from '@/app/actions/gatekeeper';
import { useRouter } from 'next/navigation';

export default function DomainsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasCloudflareConnection, setHasCloudflareConnection] = useState(false);
  const [deployingRules, setDeployingRules] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, hasConnection] = await Promise.all([
        getUserProjects(),
        checkCloudflareConnection(),
      ]);
      setProjects(projectsData);
      setHasCloudflareConnection(hasConnection);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setIsRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await registerDomain(newDomain.trim());
      
      if (result.success && result.project) {
        setSuccess(`Domain ${result.project.name} registered successfully! Your Gatekeeper API token has been generated.`);
        setNewDomain('');
        setShowAddModal(false);
        await loadData(); // Refresh the list
      } else {
        setError(result.error || 'Failed to register domain');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeployRule = async (projectId: string) => {
    setDeployingRules(prev => new Set(prev).add(projectId));
    setError(null);
    setSuccess(null);

    try {
      const result = await deploySkipRule(projectId);
      
      if (result.success) {
        setSuccess(result.message);
        await loadData(); // Refresh to show updated status
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to deploy rule');
    } finally {
      setDeployingRules(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROTECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✅ Protected
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            🔄 Ready to Deploy
          </span>
        );
      case 'PENDING_NS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            ⚠ Pending DNS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const generateCurlExample = (project: ProjectWithToken) => {
    return `curl -X GET "https://${project.name}/api/data" \\
  -H "X-Bot-Auth: ${project.gatekeeperToken}" \\
  -H "User-Agent: MyBot/1.0"`;
  };

  const generateJavaScriptExample = (project: ProjectWithToken) => {
    return `// Node.js/Browser example
const response = await fetch('https://${project.name}/api/data', {
  headers: {
    'X-Bot-Auth': '${project.gatekeeperToken}',
    'User-Agent': 'MyBot/1.0'
  }
});

const data = await response.json();
console.log('Bot access successful:', data);`;
  };

  const generatePythonExample = (project: ProjectWithToken) => {
    return `import requests

response = requests.get(
    'https://${project.name}/api/data',
    headers={
        'X-Bot-Auth': '${project.gatekeeperToken}',
        'User-Agent': 'MyBot/1.0'
    }
)

if response.status_code == 200:
    print('Bot access successful:', response.json())
else:
    print('Access denied:', response.status_code)`;
  };

  if (!hasCloudflareConnection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Cloudflare Connection Required</h3>
              <p className="text-yellow-700 mb-4">
                You need to connect your Cloudflare account before you can register domains and generate Gatekeeper API tokens.
              </p>
              <button
                onClick={() => router.push('/connect-cloudflare')}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Connect Cloudflare Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Domain Management</h1>
            <p className="text-slate-600 mt-2">
              Register domains and manage your Gatekeeper API tokens for bot bypass
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Domain
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Projects List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading domains...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No domains registered</h3>
              <p className="text-slate-600 mb-4">
                Register your first domain to generate a Gatekeeper API token and enable bot bypass.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add Your First Domain
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
                    <p className="text-sm text-slate-500">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(project.status)}
                </div>

                {/* Gatekeeper API Token */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gatekeeper API Token
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-slate-100 px-3 py-2 rounded border">
                      {project.gatekeeperToken}
                    </code>
                    <button
                      onClick={() => copyToClipboard(project.gatekeeperToken)}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                      title="Copy Token"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Zone ID */}
                {project.zoneId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Cloudflare Zone ID
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-slate-100 px-3 py-2 rounded border">
                        {project.zoneId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(project.zoneId!)}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        title="Copy Zone ID"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                  {project.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleDeployRule(project.id)}
                      disabled={deployingRules.has(project.id)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {deployingRules.has(project.id) ? 'Deploying...' : 'Deploy Skip Rule'}
                    </button>
                  )}

                  {project.status === 'PROTECTED' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800 font-medium">✅ Skip Rule Active</p>
                      <p className="text-xs text-green-700 mt-1">
                        Bots with your API token can now bypass protection
                      </p>
                    </div>
                  )}

                  {/* Example Usage */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                      Show Integration Examples
                    </summary>
                    <div className="mt-2 space-y-3">
                      {/* Curl Example */}
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-700">Curl:</p>
                          <button
                            onClick={() => copyToClipboard(generateCurlExample(project))}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="text-xs text-slate-600 overflow-x-auto">
                          {generateCurlExample(project)}
                        </pre>
                      </div>

                      {/* JavaScript Example */}
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-700">JavaScript:</p>
                          <button
                            onClick={() => copyToClipboard(generateJavaScriptExample(project))}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="text-xs text-slate-600 overflow-x-auto">
                          {generateJavaScriptExample(project)}
                        </pre>
                      </div>

                      {/* Python Example */}
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-700">Python:</p>
                          <button
                            onClick={() => copyToClipboard(generatePythonExample(project))}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="text-xs text-slate-600 overflow-x-auto">
                          {generatePythonExample(project)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Domain Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Add New Domain</h2>
              
              <form onSubmit={handleRegisterDomain} className="space-y-4">
                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-slate-700 mb-2">
                    Domain Name
                  </label>
                  <input
                    type="text"
                    id="domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isRegistering}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Domain must already be added to your Cloudflare account
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isRegistering || !newDomain.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isRegistering ? 'Registering...' : 'Register Domain'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setNewDomain('');
                      setError(null);
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}