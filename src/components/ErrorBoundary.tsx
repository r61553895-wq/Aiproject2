import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full p-8 rounded-2xl bg-[#0D0D11] border border-white/10 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5 text-[#38BDF8]">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2 tracking-tight">Произошла непредвиденная ошибка</h2>
            <p className="text-[#A0A0A8] text-sm mb-6 leading-relaxed">
              Интерфейс GROKSON защищён от критических сбоев. Нажмите кнопку ниже, чтобы перезапустить приложение.
            </p>

            <button
              onClick={this.handleReload}
              className="w-full py-3 px-5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
