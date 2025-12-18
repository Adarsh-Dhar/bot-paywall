'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getProject } from '@/app/actions/dashboard'
import CodeBlock from '@/app/dashboard/components/CodeBlock'
import { Project } from '@prisma/client'

export default function IntegratePage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  async function fetchProject() {
    try {
      setLoading(true)
      setError(null)
      const result = await getProject(projectId)

      if (!result.success) {
        setError(result.error || 'Failed to fetch project')
        return
      }

      setProject(result.data)
    } catch (err) {
      console.error('Error fetching project:', err)
      setError('An error occurred while fetching the project')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-slate-700 rounded w-1/3"></div>
            <div className="h-64 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
            {error || 'Project not found'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">{project.name}</h1>
        <p className="text-slate-400 mb-8">Integration Guide</p>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Installation</h2>
            <CodeBlock
              language="bash"
              code={`npm install @bot-paywall/sdk
# or
yarn add @bot-paywall/sdk
# or
pnpm add @bot-paywall/sdk`}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Basic Usage</h2>
            <CodeBlock
              language="javascript"
              code={`import { BotPaywall } from '@bot-paywall/sdk'

const paywall = new BotPaywall({
  projectId: '${project.id}',
  apiKey: 'your-api-key-here'
})

// Check if user has access
const hasAccess = await paywall.checkAccess()

if (!hasAccess) {
  // Redirect to payment page
  window.location.href = paywall.getPaymentUrl()
}`}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">React Integration</h2>
            <CodeBlock
              language="jsx"
              code={`import { useBotPaywall } from '@bot-paywall/sdk/react'

export function ProtectedContent() {
  const { hasAccess, loading, error } = useBotPaywall({
    projectId: '${project.id}'
  })

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!hasAccess) return <div>Please purchase access</div>

  return <div>Protected content here</div>
}`}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Configuration</h2>
            <CodeBlock
              language="javascript"
              code={`const paywall = new BotPaywall({
  projectId: '${project.id}',
  apiKey: 'your-api-key-here',
  environment: 'production', // or 'development'
  timeout: 5000, // milliseconds
  retryAttempts: 3
})`}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Project Details</h2>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Project ID</p>
                  <p className="text-white font-mono text-sm break-all">{project.id}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Created</p>
                  <p className="text-white text-sm">{new Date(project.created_at).toLocaleDateString()}</p>
                </div>
                {project.website_url && (
                  <div className="col-span-2">
                    <p className="text-slate-400 text-sm">Website</p>
                    <p className="text-white text-sm break-all">{project.website_url}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
