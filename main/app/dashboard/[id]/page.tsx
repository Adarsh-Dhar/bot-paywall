'use client';

/**
 * Project Setup Page
 * Displays project setup view based on status
 * Requirements: 2.1, 5.1, 3.1
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProjectById, verifyAndConfigure } from '@/app/actions/gatekeeper';
import { Project } from '@/types/gatekeeper';
import { PendingNameserversView } from '../components/PendingNameserversView';
import { ProtectedView } from '../components/ProtectedView';

export default function ProjectSetupPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjectById(projectId);

      if (!data) {
        setError('Project not found');
        return;
      }

      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!project) return;

    try {
      setIsVerifying(true);
      setError(null);
      const result = await verifyAndConfigure(projectId);

      if (result.status === 'error') {
        setError(result.message);
        return;
      }

      if (result.status === 'pending') {
        setError(result.message);
        return;
      }

      // Success - reload project to get updated status
      await loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading project...</div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 border border-slate-200 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Error</h1>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Project not found</div>
      </div>
    );
  }

  return (
    <>
      {project.status === 'pending_ns' && (
        <PendingNameserversView
          project={project}
          onVerify={handleVerify}
          isVerifying={isVerifying}
        />
      )}

      {project.status === 'protected' && (
        <ProtectedView project={project} />
      )}

      {error && project.status === 'pending_ns' && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </>
  );
}
