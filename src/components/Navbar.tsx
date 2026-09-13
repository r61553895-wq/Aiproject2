import React from 'react';
import { Sparkles, Shield, User as UserIcon, LogOut, Settings2, MessageSquare } from 'lucide-react';
import { Logo } from './Logo';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  onOpenRedeem: () => void;
  onOpenApiSettings: () => void;
  onLogout: () => void;
  onNavigate: (route: string) => void;
  currentRoute: string;
}

export function Navbar({
  user,
  onOpenRedeem,
  onOpenApiSettings,
  onLogout,
  onNavigate,
  currentRoute,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-[#050505]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Brand Logo */}
      <div className="flex items-center gap-6">
        <div
          onClick={() => onNavigate('#/')}
          className="cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Logo size="md" />
        </div>

        {/* Navigation links for desktop */}
        <nav className="hidden sm:flex items-center gap-1 font-medium text-xs text-[#A0A0A8]">
          <button
            onClick={() => onNavigate('#/')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              currentRoute === '#/' || currentRoute === ''
                ? 'text-white bg-white/5'
                : 'hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            Главная
          </button>
          <button
            onClick={() => onNavigate('#/chat')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentRoute.startsWith('#/chat')
                ? 'text-white bg-white/5'
                : 'hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#38BDF8]" />
            AI Чат
          </button>
        </nav>
      </div>

      {/* Right: Partner Tagline & User actions */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Slogan from specification: "YOUR AI PARTNER" & "ALWAYS ONLINE" */}
        <div className="hidden lg:flex flex-col items-end text-right">
          <span className="text-[11px] font-mono tracking-widest text-[#A0A0A8] uppercase">
            YOUR AI PARTNER
          </span>
          <span className="text-[10px] font-mono tracking-wider text-emerald-400 flex items-center gap-1 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ALWAYS ONLINE
          </span>
        </div>

        {/* User token badge if logged in */}
        {user ? (
          <div className="flex items-center gap-2">
            <div
              onClick={onOpenRedeem}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              title="Нажмите, чтобы ввести промокод"
            >
              <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
              <span className="text-xs text-[#A0A0A8] hidden xs:inline">Осталось:</span>
              <span className="font-mono text-xs font-semibold text-white group-hover:text-[#38BDF8] transition-colors">
                {user.balance.toLocaleString('ru-RU')}
              </span>
              <span className="text-[11px] text-[#A0A0A8] font-mono hidden sm:inline">
                / 20 000
              </span>
              <button
                type="button"
                className="ml-1 p-0.5 rounded bg-white/10 hover:bg-[#38BDF8] hover:text-black transition-colors"
                title="Пополнить по коду"
              >
                <Sparkles className="w-3 h-3 text-[#38BDF8] group-hover:text-white" />
              </button>
            </div>

            {user.role === 'admin' && (
              <button
                onClick={() => onNavigate('#/admin')}
                className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#38BDF8] hover:bg-white/10 transition-colors"
                title="Панель администратора"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenApiSettings}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#A0A0A8] hover:text-white hover:bg-white/10 transition-colors"
              title="Настройки API"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#A0A0A8] hover:text-red-400 hover:bg-white/10 transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenApiSettings}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#A0A0A8] hover:text-white hover:bg-white/10 transition-colors"
              title="Настройки подключения API"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('#/login')}
              className="px-4 py-2 rounded-xl border border-white/15 text-xs font-semibold text-white hover:bg-white/5 transition-colors"
            >
              Войти
            </button>

            <button
              onClick={() => onNavigate('#/register')}
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-all shadow-md shadow-white/5"
            >
              Регистрация
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
