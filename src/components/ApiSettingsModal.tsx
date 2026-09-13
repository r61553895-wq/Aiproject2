import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, Globe } from 'lucide-react';
import { getBaseApiUrl, setCustomApiUrl, api } from '../api';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  const [apiUrl, setApiUrl] = useState(getBaseApiUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    // Temporarily apply input to test
    const old = getBaseApiUrl();
    setCustomApiUrl(apiUrl || null);

    try {
      const res = await api.checkHealth();
      setTestResult({
        success: true,
        message: `Подключение успешно: ${res.service} (${res.status})`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Сервер недоступен по указанному адресу',
      });
      // Restore previous url if test failed
      setCustomApiUrl(old || null);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setCustomApiUrl(apiUrl || null);
    onClose();
    window.location.reload();
  };

  const handleReset = () => {
    setApiUrl('');
    setCustomApiUrl(null);
    setTestResult({ success: true, message: 'Сброшено на стандартный относительный адрес' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0D0D11] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#38BDF8]">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Настройки Backend API</h3>
              <p className="text-xs text-[#A0A0A8]">Для публикации на GitHub Pages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0A0A8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-[#A0A0A8]">
          <p className="leading-relaxed">
            Если frontend размещён на GitHub Pages, укажите URL вашего развёрнутого backend-сервера (например, на Cloudflare Workers, Render, Railway или VPS).
          </p>

          <div>
            <label className="block text-[11px] font-mono text-[#A0A0A8] mb-1.5 uppercase tracking-wider">
              API Base URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A0A0A8]">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://my-grokson-backend.example.com"
                className="w-full bg-[#050505] border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">
              Оставьте пустым для локальной работы или full-stack контейнера.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{testResult.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="py-2 px-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              Проверить связь
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="py-2 px-3 rounded-xl text-[#A0A0A8] hover:text-white hover:bg-white/5 text-xs"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="py-2 px-4 rounded-xl bg-white text-black font-semibold hover:bg-neutral-200 transition-all text-xs"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
