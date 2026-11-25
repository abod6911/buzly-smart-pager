'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Table as TableIcon, BarChart3 } from 'lucide-react';
import { WaitlistAiBrief } from '@/types/waitlist';

export default function HostInsightsPage() {
  const router = useRouter();
  const [brief, setBrief] = useState<WaitlistAiBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/host/insights', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          router.replace('/host/login');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (active) setBrief(data.brief);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading || !brief) {
    return (
      <div
        dir="ltr"
        className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center"
      >
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const maxDropoff = Math.max(
    1,
    ...brief.hourlyBreakdown.map((b) => b.left + b.noShow)
  );

  return (
    <div dir="ltr" className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/host"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2.5 rounded-xl text-zinc-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                End-of-Day Owner Brief · {brief.serviceDate}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Service Loss &amp; Turn Insights
              </h1>
            </div>
          </div>

          {brief.cached && (
            <div
              data-testid="brief-cached-badge"
              className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-bold"
            >
              <CheckCircle2 className="w-4 h-4" />
              Note is up to date
            </div>
          )}
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 font-medium">Total Parties</p>
            <p className="text-2xl font-extrabold font-mono mt-1">{brief.stats.totalParties}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 font-medium">Seated</p>
            <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
              {brief.stats.seatedCount}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 font-medium">Walk-aways</p>
            <p className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
              {brief.stats.leftCount}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 font-medium">No-shows</p>
            <p className="text-2xl font-extrabold font-mono text-rose-400 mt-1">
              {brief.stats.noShowCount}
            </p>
          </div>
        </div>

        {/* Hourly Drop-off Chart / Accessible Table */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                Hourly Walk-aways &amp; No-shows
              </h2>
              <p className="text-xs text-zinc-400">
                Amber = left while waiting · Rose = missed 5:00 claim window
              </p>
            </div>
          </div>

          {!showTable ? (
            <div className="h-52 flex items-end gap-3 pt-4 pb-2 border-b border-zinc-800">
              {brief.hourlyBreakdown.map((b) => {
                const total = b.left + b.noShow;
                const heightPct = Math.round((total / maxDropoff) * 100);
                const leftPct = total > 0 ? Math.round((b.left / total) * 100) : 0;
                const noShowPct = total > 0 ? 100 - leftPct : 0;

                return (
                  <div
                    key={b.hour}
                    className="flex-1 flex flex-col items-center justify-end h-full gap-2"
                  >
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      {total > 0 ? total : ''}
                    </span>
                    <div
                      className="w-full max-w-[44px] rounded-t-xl overflow-hidden flex flex-col justify-end bg-zinc-800/40 transition-all"
                      style={{ height: `${Math.max(total > 0 ? 14 : 4, heightPct)}%` }}
                    >
                      {b.noShow > 0 && (
                        <div
                          className="bg-rose-500 w-full"
                          style={{ height: `${noShowPct}%` }}
                          title={`No-show: ${b.noShow}`}
                        />
                      )}
                      {b.left > 0 && (
                        <div
                          className="bg-amber-400 w-full"
                          style={{ height: `${leftPct}%` }}
                          title={`Walked away: ${b.left}`}
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {b.hourLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                    <th className="py-2.5 pr-4">Hour</th>
                    <th className="py-2.5 pr-4">Seated</th>
                    <th className="py-2.5 pr-4">Walked away</th>
                    <th className="py-2.5">No-show</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {brief.hourlyBreakdown.map((b) => (
                    <tr key={b.hour}>
                      <td className="py-2.5 pr-4 font-medium">{b.hourLabel}</td>
                      <td className="py-2.5 pr-4 font-mono text-emerald-400">{b.seated}</td>
                      <td className="py-2.5 pr-4 font-mono text-amber-400">{b.left}</td>
                      <td className="py-2.5 font-mono text-rose-400">{b.noShow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              data-testid="toggle-chart-table"
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white underline underline-offset-4"
            >
              {showTable ? (
                <>
                  <BarChart3 className="w-3.5 h-3.5" />
                  Show as chart
                </>
              ) : (
                <>
                  <TableIcon className="w-3.5 h-3.5" />
                  Show these numbers as a table
                </>
              )}
            </button>
          </div>
        </section>

        {/* AI-Generated Narrative Note */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              Owner Brief
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Source: {brief.modelUsed}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Where we lose guests
            </h3>
            <p className="text-base text-zinc-100 leading-relaxed">
              {brief.summaryWhereLost}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">
              What to change next weekend
            </h3>
            <ul className="space-y-2.5">
              {brief.recommendations.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5 text-sm text-zinc-200"
                >
                  <span className="font-mono text-xs font-bold bg-emerald-500/20 text-emerald-300 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Written from today&apos;s counts and times. It never sees guest names or phone numbers.
            </span>
            <span>
              It updates when new parties join, so the page never pays twice for the same numbers.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
