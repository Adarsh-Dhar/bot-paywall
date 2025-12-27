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

  type ProtectedDomain = {
    id: string;
    name: string;
    status: string;
    nameservers: string;
    lastUpdated: string;
    websiteUrl: string;
    requestsCount?: number;
  };

  const protectedDomains: ProtectedDomain[] = projects?.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status || 'PENDING_NS',
    nameservers: 'Cloudflare NS',
    lastUpdated: new Date(project.updatedAt).toLocaleDateString(),
    websiteUrl: project.websiteUrl,
    requestsCount: project.requestsCount,
  })) || [];

  return (
    <DashboardClient 
      protectedDomains={protectedDomains}
      totalDomains={protectedDomains.length}
      threatsBlocked={0}
    />
  );
}
