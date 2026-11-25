'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ArrowLeft, Printer } from 'lucide-react';

export default function DoorSignPage() {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [joinUrl, setJoinUrl] = useState<string>('https://chimer.app/join');

  useEffect(() => {
    const url = `${window.location.origin}/join`;
    setJoinUrl(url);
    QRCode.toString(url, {
      type: 'svg',
      width: 280,
      margin: 2,
      color: { dark: '#09090B', light: '#FFFFFF' },
    })
      .then((svg) => setSvgMarkup(svg))
      .catch(() => {});
  }, []);

  return (
    <div dir="ltr" className="min-h-screen bg-zinc-100 text-zinc-950 p-4 sm:p-8 print:p-0 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="max-w-xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/host"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-950"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Host Stand
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          data-testid="print-sign-btn"
          className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Print Sign
        </button>
      </div>

      {/* Single-Page Printable Door Poster */}
      <article className="max-w-xl mx-auto bg-white border-2 border-zinc-900 rounded-[32px] p-8 sm:p-10 shadow-xl print:shadow-none print:rounded-none print:border-2 print:max-w-none print:w-full">
        <div className="text-center border-b-2 border-zinc-100 pb-6 mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 mb-2">
            Chimer Bistro &amp; Lounge
          </p>
          <h1 className="text-4xl font-black tracking-tight text-zinc-950">
            Scan to get in line
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center my-6">
          <div className="p-4 bg-white border-2 border-zinc-900 rounded-3xl">
            {svgMarkup ? (
              <div
                className="w-60 h-60 [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            ) : (
              <div className="w-60 h-60 bg-zinc-100 rounded-2xl animate-pulse" />
            )}
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">{joinUrl}</p>
        </div>

        <ol className="space-y-3 max-w-md mx-auto my-8 text-base font-semibold text-zinc-800">
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-zinc-950 text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span>Point your phone&apos;s camera at the code.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-zinc-950 text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span>Add your name and how many of you there are.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-zinc-950 text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <span>Keep the page open. Your phone buzzes when your table is ready.</span>
          </li>
        </ol>

        <div className="bg-zinc-100 rounded-2xl p-4 text-center text-sm font-bold text-zinc-800">
          No phone? Tell the host and we&apos;ll add you.
        </div>
      </article>
    </div>
  );
}
