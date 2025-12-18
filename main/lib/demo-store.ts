/**
 * Demo Store - In-memory database for testing without real Supabase
 * This allows testing the UI and flow without needing real credentials
 */

import { Project } from '@/types/gatekeeper';

interface DemoProject extends Project {
  id: string;
  user_id: string;
  name: string;
  zone_id: string | null;
  nameservers: string[] | null;
  status: 'pending_ns' | 'active' | 'protected';
  secret_key: string;
  created_at: string;
}

// In-memory store
const demoProjects: Map<string, DemoProject> = new Map();

export const demoStore = {
  /**
   * Create a new project
   */
  createProject(project: Omit<DemoProject, 'id' | 'created_at'>): DemoProject {
    const id = `proj_${Math.random().toString(36).substring(7)}`;
    const newProject: DemoProject = {
      ...project,
      id,
      created_at: new Date().toISOString(),
    };
    demoProjects.set(id, newProject);
    return newProject;
  },

  /**
   * Get all projects for a user
   */
  getProjectsByUser(userId: string): DemoProject[] {
    return Array.from(demoProjects.values()).filter(p => p.user_id === userId);
  },

  /**
   * Get a single project by ID
   */
  getProjectById(projectId: string): DemoProject | null {
    return demoProjects.get(projectId) || null;
  },

  /**
   * Update a project
   */
  updateProject(projectId: string, updates: Partial<DemoProject>): DemoProject | null {
    const project = demoProjects.get(projectId);
    if (!project) return null;

    const updated = { ...project, ...updates };
    demoProjects.set(projectId, updated);
    return updated;
  },

  /**
   * Delete a project
   */
  deleteProject(projectId: string): boolean {
    return demoProjects.delete(projectId);
  },

  /**
   * Clear all projects (for testing)
   */
  clear(): void {
    demoProjects.clear();
  },

  /**
   * Get all projects (for debugging)
   */
  getAll(): DemoProject[] {
    return Array.from(demoProjects.values());
  },
};
