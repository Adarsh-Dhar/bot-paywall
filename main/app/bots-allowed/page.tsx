'use client';

import { useState, useEffect } from 'react';

interface BotAllowed {
  id: string;
  ipAddress: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  timeRemaining?: number;
  isExpired?: boolean;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function BotsAllowedPage() {
  const [bots, setBots] = useState<BotAllowed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchBots = async () => {
    try {
      const response = await fetch('/api/bots-allowed');
      const result = await response.json();
      
      if (result.success) {
        setBots(result.data);
      } else {
        setError(result.error || 'Failed to fetch bots');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addBot = async () => {
    if (!newIp.trim()) {
      setError('IP address is required');
      return;
    }

    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/bots-allowed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipAddress: newIp.trim(),
          reason: newReason.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        setNewIp('');
        setNewReason('');
        fetchBots(); // Refresh the list
      } else {
        setError(result.error || 'Failed to add bot');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setAdding(false);
    }
  };

  const removeBot = async (ipAddress: string) => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/bots-allowed', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ipAddress }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        fetchBots(); // Refresh the list
      } else {
        setError(result.error || 'Failed to remove bot');
      }
    } catch (err) {
      setError('Network error occurred');
    }
  };

  useEffect(() => {
    fetchBots();
    
    // Auto-refresh every 5 seconds to update expiry times
    const interval = setInterval(() => {
      fetchBots();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading allowed bots...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Allowed Bot IPs</h1>
        <p className="text-gray-600">
          Manage IP addresses that are allowed to bypass bot protection
        </p>
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            ⚠️ <strong>Auto-Expiry:</strong> All IP addresses are automatically removed after 1 minute for security.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800">{success}</div>
        </div>
      )}

      {/* Add New Bot Form */}
      <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Add New Allowed Bot IP</h2>
        <p className="text-gray-600 mb-4">
          Add an IP address to the allowed list to bypass bot protection
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <input
              type="text"
              placeholder="192.168.1.100"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              disabled={adding}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-1">
            <input
              type="text"
              placeholder="Reason (optional)"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              disabled={adding}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-1">
            <button 
              onClick={addBot} 
              disabled={adding || !newIp.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : 'Add Bot IP'}
            </button>
          </div>
        </div>
      </div>

      {/* Bots List */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Allowed Bot IPs ({bots.length})</h2>
        <p className="text-gray-600 mb-4">Currently allowed IP addresses</p>
        
        {bots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No allowed bot IPs configured
          </div>
        ) : (
          <div className="space-y-4">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-mono text-sm">
                      {bot.ipAddress}
                    </span>
                    {bot.reason && (
                      <span className="text-sm text-gray-600">
                        {bot.reason}
                      </span>
                    )}
                    {bot.timeRemaining !== undefined && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        bot.isExpired || (bot.timeRemaining <= 0) 
                          ? 'bg-red-100 text-red-800' 
                          : bot.timeRemaining < 30000 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {formatTimeRemaining(bot.timeRemaining)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Added: {new Date(bot.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => removeBot(bot.ipAddress)}
                  className="px-3 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}