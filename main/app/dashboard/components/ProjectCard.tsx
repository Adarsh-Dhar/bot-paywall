/**
 * ProjectCard Component
 * Displays a single project with domain name and status badge
 * Requirements: 6.2, 6.3, 6.4, 6.5
 */

import { Project } from '@prisma/client';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_ns':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <span className="w-2 h-2 bg-yellow-600 rounded-full mr-2"></span>
            Pending Nameservers
          </span>
        );
      case 'protected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
            Protected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            <span className="w-2 h-2 bg-gray-600 rounded-full mr-2"></span>
            Unknown
          </span>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-6 border border-slate-200 hover:border-blue-300"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 truncate">{project.name}</h3>
          <p className="text-sm text-slate-500 mt-1">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>{getStatusBadge(project.status)}</div>
        <div className="text-slate-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
