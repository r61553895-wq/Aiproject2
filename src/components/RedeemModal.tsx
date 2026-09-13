import React, { useState } from 'react';
import { X, Sparkles, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';

interface RedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number, tokensAdded: number) => void;
}

export function RedeemModal({ isOpen, onClose, onSuccess }: RedeemModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ added: number; newBalance: number } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const res = await api.tokens.redeem(code.trim());
      setSuccessInfo({ added: res.tokensAdded, newBalance: res.newBalance });
      onSuccess(res.newBalance, res.tokensAdded);
      setTimeout(() => {
        onClose();
        setCode('');
        setSuccessInfo(null);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Не удалось активировать промокод');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0D0D11] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
        {/* Ambient subtle glow */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-24 bg-[#00F0FF]/10 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#38BDF8]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Активация промокода</h3>
              <p className="text-xs text-[#A0A0A8]">Пополните ваш баланс токенов</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A0A0A8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successInfo ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-semibold text-white">Токены успешно начислены!</h4>
            <p className="text-sm text-emerald-400 font-mono">
              +{successInfo.added.toLocaleString('ru-RU')} токенов
            </p>
            <p className="text-xs text-[#A0A0A8]">
              Новый баланс: {successInfo.newBalance.toLocaleString('ru-RU')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#A0A0A8] mb-2 uppercase tracking-wider font-mono">
                Введите код
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A0A0A8]">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="GROK-XXXX-XXXX"
                  className="w-full bg-[#050505] border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-[#A0A0A8] text-sm hover:bg-white/5 transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  'Активировать'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
