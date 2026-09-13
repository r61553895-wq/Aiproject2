interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg tracking-wider',
    md: 'text-xl tracking-widest',
    lg: 'text-2xl tracking-widest',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Stylized Brand G Symbol */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center`}>
        {/* Soft cold glow background */}
        <div className="absolute inset-0 bg-[#00F0FF]/15 rounded-xl blur-[6px]" />
        
        {/* Outer frame */}
        <div className="relative w-full h-full rounded-xl bg-gradient-to-b from-[#18181B] to-[#09090B] border border-white/20 p-1 flex items-center justify-center shadow-inner">
          <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Geometric stylized G shape */}
            <path
              d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C23.6 30 28.2 26.2 29.5 21H20.5V17H30C30 13.5 28 10 25 8C23 6.7 20.6 6 18 6Z"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* High-tech crossbar / glowing core */}
            <circle cx="18" cy="18" r="2.4" fill="#00F0FF" className="animate-pulse" />
            <path d="M19 18H28" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className={`font-extrabold text-white font-mono uppercase ${textSizes[size]}`}>
            GROKSON
          </span>
        </div>
      )}
    </div>
  );
}
