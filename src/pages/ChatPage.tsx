import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  Menu,
  RotateCcw,
  Sparkles,
  AlertCircle,
  MessageSquarePlus,
  Trash2,
} from 'lucide-react';
import { ChatSidebar } from '../components/ChatSidebar';
import { ChatMessage } from '../components/ChatMessage';
import { TokenExhaustedModal } from '../components/TokenExhaustedModal';
import { RedeemModal } from '../components/RedeemModal';
import { User, ChatSession, ChatMessage as ChatMessageType } from '../types';
import { api } from '../api';

interface ChatPageProps {
  user: User | null;
  onRefreshUser: () => Promise<void>;
  onLogout: () => void;
  onNavigate: (route: string) => void;
}

export function ChatPage({ user, onRefreshUser, onLogout, onNavigate }: ChatPageProps) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Modals
  const [showExhaustedModal, setShowExhaustedModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, generating]);

  // Load chat sessions on mount
  useEffect(() => {
    if (!user) {
      onNavigate('#/login');
      return;
    }

    loadChats();
  }, [user]);

  const loadChats = async () => {
    try {
      const res = await api.chats.list();
      setChats(res.chats);
      if (res.chats.length > 0 && !currentChatId) {
        selectChat(res.chats[0].id);
      }
    } catch (err: any) {
      console.error('Error loading chats:', err);
    }
  };

  const selectChat = async (id: string) => {
    setCurrentChatId(id);
    setErrorBanner(null);
    try {
      const res = await api.chats.getMessages(id);
      setMessages(res.messages);
    } catch (err: any) {
      setErrorBanner('Не удалось загрузить сообщения беседы');
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(undefined);
    setMessages([]);
    setErrorBanner(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      await api.chats.rename(id, newTitle);
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
    } catch (err) {
      console.error('Error renaming:', err);
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await api.chats.delete(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (currentChatId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || generating) return;

    if (!user) {
      onNavigate('#/login');
      return;
    }

    if (user.balance <= 0) {
      setShowExhaustedModal(true);
      return;
    }

    // Clear input & reset errors
    if (!customText) setInputText('');
    setErrorBanner(null);

    // Optimistically add user message to list
    const tempUserMsg: ChatMessageType = {
      id: 'temp_' + Date.now(),
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setGenerating(true);

    try {
      const res = await api.chats.sendMessage(textToSend, currentChatId);

      const assistantMsg: ChatMessageType = {
        id: res.messageId,
        role: 'assistant',
        content: res.reply,
        tokens_used: res.tokensUsed,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If new session created, update state
      if (!currentChatId || currentChatId !== res.sessionId) {
        setCurrentChatId(res.sessionId);
        loadChats();
      }

      // Refresh balance in state
      await onRefreshUser();
    } catch (err: any) {
      console.error('Send error:', err);
      if (err.code === 'TOKENS_EXHAUSTED' || err.status === 403) {
        setShowExhaustedModal(true);
      } else {
        setErrorBanner(
          err.message || 'Не удалось получить ответ. Пожалуйста, повторите попытку.'
        );
      }
    } finally {
      setGenerating(false);
    }
  };

  // Handle Enter & Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Regenerate last assistant response
  const handleRegenerate = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      // Remove last assistant message if exists
      if (messages[messages.length - 1].role === 'assistant') {
        setMessages((prev) => prev.slice(0, -1));
      }
      handleSendMessage(lastUserMessage.content);
    }
  };

  // Clear current conversation
  const handleClearMessages = () => {
    if (currentChatId) {
      handleDeleteChat(currentChatId);
    } else {
      setMessages([]);
    }
  };

  return (
    <div className="relative h-[calc(100vh-65px)] flex overflow-hidden bg-[#050505]">
      {/* Sidebar / Drawer */}
      <ChatSidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onOpenRedeem={() => setShowRedeemModal(true)}
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Main Chat View */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Chat Bar */}
        <div className="h-14 px-4 sm:px-6 border-b border-white/5 flex items-center justify-between bg-[#08080B]/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-[#A0A0A8] hover:text-white hover:bg-white/5 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="truncate">
              <h2 className="text-sm font-semibold text-white truncate">
                {chats.find((c) => c.id === currentChatId)?.title || 'Новая беседа'}
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] text-[#A0A0A8] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Grokson Online</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="p-2 rounded-xl text-[#A0A0A8] hover:text-white hover:bg-white/5 transition-colors"
              title="Начать новую беседу"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleClearMessages}
                className="p-2 rounded-xl text-[#A0A0A8] hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Очистить чат"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => handleSendMessage()}
              className="font-semibold underline hover:text-red-300 ml-4 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Повторить
            </button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 space-y-4 select-none">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#18181B] to-[#0A0A0D] border border-white/10 flex items-center justify-center glow-cyan-sm">
                <Sparkles className="w-6 h-6 text-[#38BDF8]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Чем могу помочь сегодня?</h3>
                <p className="text-xs text-[#A0A0A8] leading-relaxed">
                  Я готов написать код, объяснить сложный концепт, провести анализ или погенерировать свежие идеи.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
                {[
                  'Напиши чистую функцию на TypeScript',
                  'Помоги придумать идеи для проекта',
                  'Объясни, как работает CORS',
                  'Расскажи о системе токенов Grokson',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(prompt);
                      handleSendMessage(prompt);
                    }}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.05] text-xs text-neutral-300 transition-all text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage
                key={msg.id || index}
                message={msg}
                onRegenerate={handleRegenerate}
                isLast={index === messages.length - 1}
              />
            ))
          )}

          {/* Typing / Generating Indicator */}
          {generating && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#0A0A0E] border border-white/10 w-fit max-w-xs animate-in fade-in">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[#38BDF8]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#A0A0A8] font-mono">
                <span>Генерация</span>
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar verbatim according to prompt:
            [ Напишите сообщение... ] [↑]
            Рядом: "Осталось: XXXX / 20 000 токенов"
        */}
        <div className="p-3 sm:p-4 border-t border-white/5 bg-[#08080B]/90 backdrop-blur-md shrink-0">
          <div className="max-w-4xl mx-auto space-y-2">
            {/* Input Box */}
            <div className="relative flex items-end gap-2 bg-[#050505] border border-white/15 focus-within:border-[#38BDF8] rounded-2xl p-2.5 sm:p-3 transition-colors shadow-lg">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите сообщение..."
                rows={1}
                disabled={generating}
                className="flex-1 bg-transparent border-none text-white text-sm sm:text-[15px] resize-none focus:outline-none placeholder:text-[#A0A0A8]/50 max-h-36 overflow-y-auto px-2 py-1 leading-relaxed"
                style={{ minHeight: '36px' }}
              />

              {/* Send Button [↑] */}
              <button
                onClick={() => handleSendMessage()}
                disabled={generating || !inputText.trim()}
                className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer shadow-md"
                title="Отправить (Enter)"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-800" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Bottom token balance badge verbatim from prompt:
                "Осталось: XXXX / 20 000 токенов"
            */}
            <div className="flex items-center justify-between px-2 text-[11px] text-[#A0A0A8] font-mono">
              <div className="flex items-center gap-1.5">
                <span>Осталось:</span>
                <span
                  className={`font-semibold ${
                    (user?.balance ?? 0) < 3000 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {(user?.balance ?? 0).toLocaleString('ru-RU')}
                </span>
                <span>/ 20 000 токенов</span>
                <button
                  onClick={() => setShowRedeemModal(true)}
                  className="ml-2 text-[#00F0FF] hover:underline cursor-pointer"
                >
                  + Пополнить
                </button>
              </div>

              <div className="hidden sm:block text-[10px] text-[#A0A0A8]/60">
                Shift + Enter — новая строка • Enter — отправить
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TokenExhaustedModal
        isOpen={showExhaustedModal}
        onClose={() => setShowExhaustedModal(false)}
        onOpenRedeem={() => {
          setShowExhaustedModal(false);
          setShowRedeemModal(true);
        }}
      />

      <RedeemModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        onSuccess={async (newBalance) => {
          await onRefreshUser();
        }}
      />
    </div>
  );
}
