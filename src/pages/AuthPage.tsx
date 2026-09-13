import React, { useState } from 'react';
import { Sparkles, AlertCircle, ArrowRight, Loader2, Lock, User as UserIcon, Mail } from 'lucide-react';
import { Logo } from '../components/Logo';
import { api } from '../api';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  onSuccess: () => Promise<void>;
  onNavigate: (route: string) => void;
}

export function AuthPage({ initialMode = 'login', onSuccess, onNavigate }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await api.auth.login(username.trim(), password);
      } else {
        await api.auth.register(username.trim(), email.trim() || undefined, password);
      }
      await onSuccess();
      onNavigate('#/chat');
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Ambient background light */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00F0FF]/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0D0D11] border border-white/10 rounded-3xl p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="inline-block mb-3">
            <Logo size="md" />
          </div>
          <p className="text-xs text-[#A0A0A8]">
            {isLogin
              ? 'Войдите в ваш аккаунт для продолжения работы'
              : 'Создайте аккаунт и получите 20 000 бесплатных токенов'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/5 mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              isLogin ? 'bg-white text-black shadow-sm' : 'text-[#A0A0A8] hover:text-white'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              !isLogin ? 'bg-white text-black shadow-sm' : 'text-[#A0A0A8] hover:text-white'
            }`}
          >
            Регистрация (+20K)
          </button>
        </div>

        {/* Registration gift banner */}
        {!isLogin && (
          <div className="mb-6 p-3.5 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center gap-2.5 text-xs text-[#38BDF8]">
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Новым пользователям сразу начисляется 20 000 токенов на сервере!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username field */}
          <div>
            <label className="block text-xs font-mono text-[#A0A0A8] mb-1.5 uppercase tracking-wider">
              Логин или Имя пользователя
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A0A0A8]">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="например: alex"
                required
                className="w-full bg-[#050505] border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>
          </div>

          {/* Email field (optional, only during registration) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-mono text-[#A0A0A8] mb-1.5 uppercase tracking-wider">
                Email (необязательно)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A0A0A8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#050505] border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#38BDF8] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Password field */}
          <div>
            <label className="block text-xs font-mono text-[#A0A0A8] mb-1.5 uppercase tracking-wider">
              Пароль
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A0A0A8]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#050505] border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 rounded-xl bg-white text-black font-bold text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/5 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Войти в GROKSON' : 'Зарегистрироваться'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5 text-center text-xs text-[#A0A0A8]">
          <span>Нужен доступ администратора? </span>
          <button
            onClick={() => onNavigate('#/admin')}
            className="text-white hover:underline font-medium"
          >
            Панель управления
          </button>
        </div>
      </div>
    </div>
  );
}
