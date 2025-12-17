'use client'

import Link from 'next/link'

interface Project {
  id: string
  user_id: string
  name: string
  website_url?: string
  requests_count: number
  created_at: string
  updated_at: string
}

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Link href={`/dashboard/${project.id}/integrate`}>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-blue-500 transition cursor-pointer h-full">
        <h3 className="text-xl font-semibold text-white mb-2">{project.name}</h3>

        {project.website_url && (
          <p className="text-slate-400 text-sm mb-4 truncate">
            <span className="text-slate-500">Website: </span>
            {project.website_url}
          </p>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Requests</span>
            <span className="text-white font-semibold">{project.requests_count.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Created</span>
            <span className="text-white text-sm">{createdDate}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-blue-400 text-sm font-medium hover:text-blue-300">View Integration →</p>
        </div>
      </div>
    </Link>
  )
}
