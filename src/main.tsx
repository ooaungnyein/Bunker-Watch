import React, { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App Crash Caught by ErrorBoundary:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('bunker_watch_data');
      localStorage.removeItem('bunker_watch_last_sync');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050B15] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-[#0A192F] border border-white/10 p-8 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Application Notice</h2>
            <p className="text-xs text-slate-400 font-medium">
              A temporary interface issue occurred. Tap below to reload fresh data.
            </p>
            <div className="text-[10px] text-slate-500 font-mono bg-black/40 p-2 rounded-lg break-all text-left max-h-24 overflow-y-auto">
              {this.state.error?.message || "Unknown error"}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-3.5 bg-gradient-to-r from-[#00A8A8] to-[#4DE8E8] text-[#0A192F] font-black text-xs uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-lg shadow-cyan-500/20"
            >
              Reset & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Clean up any stale service workers in preview or development mode to prevent white screens
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV || window.location.hostname.includes('run.app')) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key).catch(() => {});
        }
      });
    }
  }
}

if (import.meta.env.PROD && !window.location.hostname.includes('run.app')) {
  try {
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          console.log('SW update available');
        },
        onOfflineReady() {
          console.log('App ready to work offline');
        },
        immediate: false,
      });
    }).catch(() => {});
  } catch (e) {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

