'use client';

/**
 * Dashboard Page
 * Displays all user projects in a grid layout
 * Requirements: 6.1, 6.2
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProjectsByUser } from '@/app/actions/gatekeeper';
import { Project } from '@prisma/client';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ProjectCard } from './components/ProjectCard';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      const data = await getProjectsByUser();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleProjectCreated() {
    setIsModalOpen(false);
    loadProjects();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Gatekeeper</h1>
            <p className="text-slate-600 mt-2">Manage your protected domains</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Add New Domain
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-slate-600">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No projects yet</h2>
            <p className="text-slate-600 mb-6">
              Get started by adding your first domain to protect it with Gatekeeper.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Your First Domain
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/dashboard/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
