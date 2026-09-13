import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Shield,
  LogOut,
  Sliders,
} from 'lucide-react';
import { ChatSession, User } from '../types';
import { Logo } from './Logo';

interface ChatSidebarProps {
  chats: ChatSession[];
  currentChatId?: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenRedeem: () => void;
  user: User | null;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export function ChatSidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onOpenRedeem,
  user,
  onLogout,
  isOpen,
  onClose,
  onNavigate,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startRename = (chat: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const saveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const tokenProgress = user ? Math.min(100, Math.max(0, (user.balance / 20000) * 100)) : 0;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 bg-[#08080B] border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div
            onClick={() => onNavigate('#/')}
            className="cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Logo size="sm" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A0A0A8] hover:text-white hover:bg-white/5 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Новая беседа
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 py-1.5 text-[11px] font-mono text-[#A0A0A8] uppercase tracking-wider">
            История бесед ({chats.length})
          </div>

          {chats.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#A0A0A8] border border-dashed border-white/5 rounded-xl">
              У вас пока нет начатых бесед. Нажмите «Новая беседа», чтобы начать диалог.
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = chat.id === currentChatId;
              const isEditing = editingId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    onSelectChat(chat.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-white font-medium border border-white/10'
                      : 'text-[#A0A0A8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className="w-4 h-4 shrink-0 text-[#38BDF8]" />
                    {isEditing ? (
                      <form
                        onSubmit={(e) => saveRename(chat.id, e)}
                        className="flex items-center gap-1 flex-1 mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-[#050505] border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={(e) => saveRename(chat.id, e)}
                          className="p-1 hover:text-emerald-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span className="truncate">{chat.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1 text-[#A0A0A8]">
                      <button
                        onClick={(e) => startRename(chat, e)}
                        className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Переименовать"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Удалить эту беседу?')) {
                            onDeleteChat(chat.id);
                          }
                        }}
                        className="p-1 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Token Balance Card */}
        {user && (
          <div className="p-3 border-t border-white/5">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A0A0A8]">Баланс токенов:</span>
                <span className="font-mono font-semibold text-white">
                  {user.balance.toLocaleString('ru-RU')}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    user.balance > 5000 ? 'bg-[#38BDF8]' : 'bg-red-400'
                  }`}
                  style={{ width: `${tokenProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[#A0A0A8]">Лимит: 20 000</span>
                <button
                  onClick={onOpenRedeem}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#00F0FF] hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Пополнить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Footer */}
        <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs">
          {user ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white uppercase text-xs">
                  {user.username.slice(0, 1)}
                </div>
                <div className="truncate">
                  <p className="font-medium text-white truncate">{user.username}</p>
                  <p className="text-[10px] text-[#A0A0A8] font-mono capitalize">{user.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {user.role === 'admin' && (
                  <button
                    onClick={() => onNavigate('#/admin')}
                    className="p-1.5 rounded-lg text-[#38BDF8] hover:bg-white/10 transition-colors"
                    title="Панель администратора"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-[#A0A0A8] hover:text-red-400 hover:bg-white/10 transition-colors"
                  title="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-2">
              <button
                onClick={() => onNavigate('#/login')}
                className="w-full py-2 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors text-center"
              >
                Войти в аккаунт
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
