import { useState } from 'react';
import Markdown from 'react-markdown';
import { Copy, Check, RotateCcw, User as UserIcon } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../types';
import { CodeBlock } from './CodeBlock';

interface ChatMessageProps {
  message: ChatMessageType;
  onRegenerate?: () => void;
  isLast?: boolean;
}

export function ChatMessage({ message, onRegenerate, isLast }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className={`group relative flex gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl transition-all ${
        isUser
          ? 'bg-white/[0.03] border border-white/5 ml-auto max-w-[88%] sm:max-w-[78%]'
          : 'bg-[#0A0A0E] border border-white/10 w-full shadow-lg'
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
            <UserIcon className="w-4 h-4" />
          </div>
        ) : (
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-b from-[#18181B] to-[#09090B] border border-[#00F0FF]/30 p-1 flex items-center justify-center glow-cyan-sm">
            <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header (Author & Meta) */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
            {isUser ? 'Вы' : 'Grokson'}
            {!isUser && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/10 text-[#38BDF8]">
                AI
              </span>
            )}
          </span>

          <div className="flex items-center gap-2 text-[#A0A0A8] text-[11px] font-mono opacity-60 group-hover:opacity-100 transition-opacity">
            {message.tokens_used ? (
              <span>{message.tokens_used} токенов</span>
            ) : null}
            <span>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Message Body */}
        <div className="text-neutral-200 text-sm sm:text-[15px] leading-relaxed break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown-body space-y-3 prose prose-invert max-w-none text-neutral-200">
              <Markdown
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    if (!inline && (match || codeString.includes('\n'))) {
                      return <CodeBlock language={match ? match[1] : ''} code={codeString} />;
                    }
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded bg-white/10 text-[#38BDF8] font-mono text-[13px]"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="mb-2 leading-relaxed">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc list-inside space-y-1 my-2 text-neutral-300">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside space-y-1 my-2 text-neutral-300">{children}</ol>;
                  },
                  h1({ children }) {
                    return <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="text-lg font-bold text-white mt-3 mb-2">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="text-base font-semibold text-white mt-2 mb-1">{children}</h3>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-2 border-[#38BDF8] pl-3 py-1 my-2 text-neutral-400 italic">
                        {children}
                      </blockquote>
                    );
                  },
                }}
              >
                {message.content}
              </Markdown>
            </div>
          )}
        </div>

        {/* Footer Actions (Copy & Regenerate for assistant) */}
        {!isUser && (
          <div className="pt-2 flex items-center gap-2 border-t border-white/5 text-xs text-[#A0A0A8]">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white/5 hover:text-white transition-colors"
              title="Скопировать ответ"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Копировать</span>
                </>
              )}
            </button>

            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white/5 hover:text-white transition-colors text-[11px]"
                title="Перегенерировать ответ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Повторить</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
