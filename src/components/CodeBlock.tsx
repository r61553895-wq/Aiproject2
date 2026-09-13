import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3 rounded-xl border border-white/10 bg-[#070709] overflow-hidden text-xs">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/10 text-[#A0A0A8] font-mono">
        <span className="uppercase text-[11px] tracking-wider text-[#38BDF8]">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          title="Скопировать код"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-neutral-200 selection:bg-white/20">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
