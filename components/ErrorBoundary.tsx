'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Buzly ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      if (typeof window !== 'undefined') {
        // Self-heal corrupted localStorage entries if any
        localStorage.removeItem('buzly_multitenant_orders_v3');
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {this.props.fallbackTitle || 'تعذر تحميل هذه الصفحة بالشكل المعتاد'}
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
            تم رصد خطأ غير متوقع. يمكنك استعادة المنظومة وتفريغ الذاكرة المؤقتة بنقرة واحدة.
          </p>
          <button
            onClick={this.handleReset}
            className="py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#052E16] font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة التشغيل والتحديث التلقائي</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
