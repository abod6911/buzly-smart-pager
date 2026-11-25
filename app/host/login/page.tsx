'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock } from 'lucide-react';

export default function HostLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/host/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }
      router.push('/host');
      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="ltr"
      className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6"
    >
      <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-7 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5">
          <KeyRound className="w-6 h-6 text-emerald-400" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          Host stand
        </h1>
        <p className="text-sm text-zinc-400 mb-6">
          Sign in to manage the live waitlist and buzz guests.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="host-email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Email
            </label>
            <input
              id="host-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="host@chimer.app"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="host-password" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <input
              id="host-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium px-3.5 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="host-signin-btn"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-500 leading-relaxed">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600" />
          <span>
            Staff only. Guests don&apos;t sign in. They join by scanning the sign at the door.
          </span>
        </div>
      </div>
    </div>
  );
}
