// /app/page.tsx
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getProjects } from '@/app/actions/dashboard';
import DashboardClient from '../components/DashboardClient';

export default async function Home() {
  // Check authentication
  const authResult = await auth();
  if (!authResult) {
    redirect('/sign-in');
  }

  // Fetch user's projects
  const projectsResult = await getProjects();
  const projects = projectsResult.success ? projectsResult.data : [];

  // Use a different local type name to avoid colliding with the component's ProtectedDomain
  type DomainView = {
    id: string;
    name: string;
    status: string;
    nameservers: string;
    lastUpdated: string;
    websiteUrl?: string | null;
  };

  const protectedDomains: DomainView[] = projects?.map((project) => ({
    id: project.id,
    name: project.websiteUrl || 'Unknown',
    status: project.status || 'PENDING_NS',
    nameservers: 'Cloudflare NS',
    lastUpdated: new Date(project.updatedAt).toLocaleDateString(),
    websiteUrl: project.websiteUrl,
  })) || [];

  return (
      <DashboardClient
          protectedDomains={protectedDomains}
          totalDomains={protectedDomains.length}
          threatsBlocked={0}
      />
  );
}
