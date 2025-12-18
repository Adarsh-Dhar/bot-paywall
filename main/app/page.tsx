import { redirect } from 'next/navigation';
import { auth } from '@/lib/mock-auth';
import { getProjects } from '@/app/actions/dashboard';
import DashboardClient from '../components/DashboardClient';

export default async function Home() {
  // Check authentication
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch user's projects
  const projectsResult = await getProjects();
  const projects = projectsResult.success ? projectsResult.data : [];

  // Transform projects to match the expected format
  const protectedDomains = projects?.map((project: any) => ({
    id: project.id,
    name: project.name,
    status: 'Active', // You can map this from project.status if needed
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


