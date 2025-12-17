'use client'

import { useEffect, useState } from 'react'
import { getProjects, incrementUsage } from '@/app/actions/dashboard'
import ProjectCard from '@/app/dashboard/components/ProjectCard'
import CreateProjectModal from '@/app/dashboard/components/CreateProjectModal'

interface Project {
  id: string
  user_id: string
  name: string
  website_url?: string
  requests_count: number
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      setError(null)
      const result = await getProjects()

      if (!result.success) {
        setError(result.error || 'Failed to fetch projects')
        return
      }

      setProjects(result.data || [])

      // Increment usage for each project to simulate traffic
      if (result.data && result.data.length > 0) {
        for (const project of result.data) {
          await incrementUsage(project.id)
        }
        // Refresh projects after incrementing usage
        const refreshResult = await getProjects()
        if (refreshResult.success) {
          setProjects(refreshResult.data || [])
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError('An error occurred while fetching projects')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectCreated = () => {
    setShowCreateModal(false)
    fetchProjects()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-slate-700 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Projects</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Create Project
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">No projects yet</h2>
            <p className="text-slate-400 mb-6">Create your first project to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} onSuccess={handleProjectCreated} />}
    </div>
  )
}
