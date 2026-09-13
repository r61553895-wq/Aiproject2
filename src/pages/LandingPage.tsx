import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import robotHeroImage from '../assets/images/grokson_robot_hero_1789280598834.jpg';

interface LandingPageProps {
  onStart: () => void;
  onNavigate: (route: string) => void;
}

export function LandingPage({ onStart, onNavigate }: LandingPageProps) {
  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00F0FF]/[0.03] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none" />

      {/* Main Hero Container */}
      <main className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-12 sm:py-20 w-full flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
        {/* Left Column: Text & Content */}
        <div className="flex-1 max-w-2xl text-left space-y-8">
          {/* Tag badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-[#A0A0A8] font-mono tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
            <span>20 000 БЕСПЛАТНЫХ ТОКЕНОВ ПРИ СТАРТЕ</span>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="text-3xl sm:text-4xl font-normal text-[#A0A0A8] tracking-tight">
              Привет! 👋
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05]">
              Я — Grokson
            </h1>
          </div>

          {/* Subtitle verbatim from prompt */}
          <p className="text-lg sm:text-xl text-[#A0A0A8] font-normal leading-relaxed max-w-xl">
            Я — ИИ, который всегда рядом. Отвечаю на вопросы, помогаю, ищу, думаю вместе с тобой и просто стараюсь быть полезным.
          </p>

          {/* Bullet points verbatim from prompt */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-sm sm:text-base text-neutral-200">
              <span className="text-[#38BDF8] text-lg leading-none">●</span>
              <span>Отвечаю на любые вопросы</span>
            </div>
            <div className="flex items-center gap-3 text-sm sm:text-base text-neutral-200">
              <span className="text-[#38BDF8] text-lg leading-none">●</span>
              <span>Помогаю с идеями и задачами</span>
            </div>
            <div className="flex items-center gap-3 text-sm sm:text-base text-neutral-200">
              <span className="text-[#38BDF8] text-lg leading-none">●</span>
              <span>Поддерживаю и шучу</span>
            </div>
            <div className="flex items-center gap-3 text-sm sm:text-base text-neutral-200">
              <span className="text-[#38BDF8] text-lg leading-none">●</span>
              <span>Всегда на связи</span>
            </div>
          </div>

          {/* CTA Button: "Начать" */}
          <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={onStart}
              className="group relative px-9 py-4 rounded-2xl bg-white text-black font-bold text-base tracking-wide hover:bg-neutral-200 transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-white/10 hover:shadow-white/20 active:scale-[0.98]"
            >
              <span>Начать</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate('#/register')}
              className="px-6 py-4 rounded-2xl border border-white/10 text-white hover:bg-white/5 transition-all text-sm font-semibold flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#38BDF8]" />
              Получить 20 000 токенов
            </button>
          </div>
        </div>

        {/* Right Column: Visual AI Robot Character */}
        <div className="flex-1 w-full max-w-md lg:max-w-lg relative flex items-center justify-center">
          {/* Circular cold glow backplate */}
          <div className="absolute inset-0 bg-radial from-[#00F0FF]/15 to-transparent blur-2xl rounded-full transform scale-95" />

          {/* Character Card Frame */}
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#121217] via-[#09090C] to-[#050505] p-2 shadow-2xl glow-white-sm">
            {/* Robot Image */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <img
                src={robotHeroImage}
                alt="Grokson AI Companion Character in black hoodie with glowing visor"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700 ease-out"
              />

              {/* Holographic overlay details */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80" />

              {/* Status Badge */}
              <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-xl bg-[#09090C]/85 backdrop-blur-md border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">Grokson Neural Core</p>
                    <p className="text-[10px] text-[#A0A0A8] font-mono">Status: Ready & Online</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-mono font-medium text-[#38BDF8]">
                    20 000 TOKENS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Trust & Architecture bar */}
      <section className="border-t border-white/5 bg-[#070709] py-6 px-6 sm:px-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-around gap-6 text-xs text-[#A0A0A8] font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#38BDF8]" />
            <span>СЕРВЕРНАЯ БЕЗОПАСНОСТЬ КЛЮЧЕЙ</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00F0FF]" />
            <span>МОЛНИЕНОСНЫЙ ОТКЛИК</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>СОВМЕСТИМОСТЬ С GITHUB PAGES</span>
          </div>
        </div>
      </section>
    </div>
  );
}
