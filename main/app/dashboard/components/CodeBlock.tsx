'use client'

import { useState } from 'react'

interface CodeBlockProps {
  language: string
  code: string
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-slate-800 border-b border-slate-700">
        <span className="text-slate-400 text-sm font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-white text-sm font-medium transition"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-slate-300 text-sm font-mono whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  )
}
