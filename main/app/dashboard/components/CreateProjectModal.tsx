'use client'

import { useState } from 'react'
import { createProject } from '@/app/actions/dashboard'

interface CreateProjectModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [website_url, setWebsiteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', name)
      if (website_url) {
        formData.append('website_url', website_url)
      }

      const result = await createProject(formData)

      if (!result.success) {
        setError(result.error || 'Failed to create project')
        return
      }

      // Show API key
      setApiKey(result.apiKey || null)
      setName('')
      setWebsiteUrl('')
    } catch (err) {
      console.error('Error creating project:', err)
      setError('An error occurred while creating the project')
    } finally {
      setLoading(false)
    }
  }

  function handleCopyApiKey() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleAcknowledge() {
    setApiKey(null)
    setCopied(false)
    onSuccess()
  }

  if (apiKey) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-4">API Key Created</h2>

          <div className="bg-slate-900 border border-slate-700 rounded p-4 mb-6">
            <p className="text-slate-400 text-sm mb-2">Your API Key (save this securely):</p>
            <p className="text-white font-mono text-sm break-all">{apiKey}</p>
          </div>

          <button
            onClick={handleCopyApiKey}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-3 transition"
          >
            {copied ? '✓ Copied!' : 'Copy API Key'}
          </button>

          <button
            onClick={handleAcknowledge}
            disabled={!copied}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition"
          >
            I have copied this
          </button>

          <p className="text-slate-400 text-xs mt-4 text-center">You won't be able to see this key again</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-6">Create Project</h2>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Website URL (optional)</label>
            <input
              type="url"
              value={website_url}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
