import React, { useState, useEffect } from 'react';
import {
  Shield,
  LayoutDashboard,
  Users,
  Coins,
  Ticket,
  Bot,
  Sliders,
  FileText,
  Lock,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import { api, getAdminToken } from '../api';
import {
  AdminStats,
  AdminUserRecord,
  PromoCode,
  AdminSettings,
  AdminLog,
  TokenTransaction,
} from '../types';

interface AdminPageProps {
  onNavigate: (route: string) => void;
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const [isAdminAuth, setIsAdminAuth] = useState(Boolean(getAdminToken()));
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Active section
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'users' | 'tokens' | 'codes' | 'ai' | 'api' | 'security' | 'logs' | 'settings'
  >('dashboard');

  // Tab Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [aiSettings, setAiSettings] = useState<AdminSettings | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Modals & form inputs
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [newCodeForm, setNewCodeForm] = useState({
    tokens: 20000,
    codeType: 'single' as 'single' | 'multi',
    maxActivations: 1,
    expiresDays: '',
    customCode: '',
  });

  // Grant tokens to user modal
  const [grantTargetUser, setGrantTargetUser] = useState<AdminUserRecord | null>(null);
  const [grantAmount, setGrantAmount] = useState('10000');
  const [grantReason, setGrantReason] = useState('Бонус администратора');

  // AI Connection testing
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    status: string;
    latencyMs: number;
    provider: string;
    model: string;
    response: string;
    error?: string;
  } | null>(null);

  // New API Key form state
  const [newApiKey, setNewApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('grokson-v1');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [systemPrompt, setSystemPrompt] = useState('Ты — Grokson, персональный премиальный AI-помощник.');

  // User search filter
  const [userSearch, setUserSearch] = useState('');

  // Password change state
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (isAdminAuth) {
      loadTabData(activeTab);
    }
  }, [isAdminAuth, activeTab]);

  const loadTabData = async (tab: string) => {
    setLoadingData(true);
    setStatusMessage(null);
    try {
      if (tab === 'dashboard') {
        const data = await api.admin.getStats();
        setStats(data);
      } else if (tab === 'users') {
        const data = await api.admin.getUsers();
        setUsers(data.users);
      } else if (tab === 'codes') {
        const data = await api.admin.getCodes();
        setCodes(data.codes);
      } else if (tab === 'tokens') {
        const data = await api.admin.getTransactions();
        setTransactions(data.transactions);
      } else if (tab === 'ai' || tab === 'settings' || tab === 'api') {
        const data = await api.admin.getSettings();
        setAiSettings(data);
        setSelectedModel(data.model);
        setTemperature(data.temperature);
        setMaxTokens(data.maxTokens);
        setSystemPrompt(data.systemPrompt);
      } else if (tab === 'logs' || tab === 'security') {
        const data = await api.admin.getLogs();
        setLogs(data.logs);
      }
    } catch (err: any) {
      console.error('Error loading tab:', err);
      if (err.status === 401 || err.status === 403) {
        setIsAdminAuth(false);
        api.admin.logout();
      } else {
        setStatusMessage({ text: err.message || 'Ошибка загрузки данных', error: true });
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setAuthError(null);
    try {
      await api.admin.login(loginForm.login, loginForm.password);
      setIsAdminAuth(true);
    } catch (err: any) {
      setAuthError(err.message || 'Неверный логин или пароль администратора');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleAdminLogout = () => {
    api.admin.logout();
    setIsAdminAuth(false);
  };

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {}
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createCode({
        tokens: Number(newCodeForm.tokens),
        codeType: newCodeForm.codeType,
        maxActivations: Number(newCodeForm.maxActivations),
        expiresDays: newCodeForm.expiresDays ? Number(newCodeForm.expiresDays) : null,
        customCode: newCodeForm.customCode || undefined,
      });
      setShowCreateCodeModal(false);
      setNewCodeForm({
        tokens: 20000,
        codeType: 'single',
        maxActivations: 1,
        expiresDays: '',
        customCode: '',
      });
      loadTabData('codes');
      setStatusMessage({ text: 'Промокод успешно создан' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Ошибка создания промокода', error: true });
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Удалить данный промокод?')) return;
    try {
      await api.admin.deleteCode(id);
      loadTabData('codes');
      setStatusMessage({ text: 'Промокод удален' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Ошибка удаления', error: true });
    }
  };

  const handleGrantTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantTargetUser) return;
    try {
      await api.admin.grantTokens(grantTargetUser.id, Number(grantAmount), grantReason);
      setGrantTargetUser(null);
      loadTabData('users');
      setStatusMessage({ text: `Токены успешно начислены пользователю ${grantTargetUser.username}` });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Ошибка начисления', error: true });
    }
  };

  const handleTestAiConnection = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await api.admin.testApi();
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({
        status: 'offline',
        latencyMs: 0,
        provider: 'Internal AI Provider',
        model: selectedModel,
        response: '',
        error: err.message || 'Ошибка связи с провайдером',
      });
    } finally {
      setTestingAi(false);
    }
  };

  const handleSaveAiSettings = async () => {
    try {
      await api.admin.updateSettings({
        apiKey: newApiKey.trim() || undefined,
        model: selectedModel,
        temperature,
        maxTokens,
        systemPrompt,
      });
      setNewApiKey('');
      loadTabData('ai');
      setStatusMessage({ text: 'Настройки AI успешно обновлены на сервере' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Ошибка сохранения настроек', error: true });
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewPassword || adminNewPassword.length < 6) {
      setPasswordChangeStatus({ message: 'Пароль должен содержать не менее 6 символов', isError: true });
      return;
    }
    setSavingPassword(true);
    setPasswordChangeStatus(null);
    try {
      const res = await api.admin.changePassword(adminNewPassword);
      setPasswordChangeStatus({ message: res.message || 'Пароль успешно обновлен!', isError: false });
      setAdminNewPassword('');
    } catch (err: any) {
      setPasswordChangeStatus({ message: err.message || 'Ошибка обновления пароля', isError: true });
    } finally {
      setSavingPassword(false);
    }
  };

  // 1. Admin Login View if not authorized
  if (!isAdminAuth) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0D0D11] border border-white/10 rounded-3xl p-8 shadow-2xl relative">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-[#38BDF8]">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Вход в Admin Panel</h2>
            <p className="text-xs text-[#A0A0A8] mt-1">Доступ к системе управления сервисом GROKSON</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[#A0A0A8] mb-1.5 uppercase">
                Логин администратора
              </label>
              <input
                type="text"
                value={loginForm.login}
                onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
                placeholder="ADMIN_LOGIN"
                required
                className="w-full bg-[#050505] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#A0A0A8] mb-1.5 uppercase">
                Пароль администратора
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="ADMIN_PASSWORD"
                required
                className="w-full bg-[#050505] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingAuth}
              className="w-full py-3 px-5 rounded-xl bg-white text-black font-bold text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {loadingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Авторизоваться'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => onNavigate('#/')}
              className="text-xs text-[#A0A0A8] hover:text-white transition-colors"
            >
              ← Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#050505] flex flex-col md:flex-row">
      {/* Admin Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#08080B] border-r border-white/10 p-4 shrink-0 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-white font-mono text-xs font-bold uppercase tracking-wider">
              <Shield className="w-4 h-4 text-[#38BDF8]" />
              <span>Admin Console</span>
            </div>
            <button
              onClick={() => loadTabData(activeTab)}
              disabled={loadingData}
              className="p-1.5 rounded text-[#A0A0A8] hover:text-white"
              title="Обновить данные"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <nav className="space-y-1 text-xs">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'tokens', label: 'Tokens', icon: Coins },
              { id: 'codes', label: 'Promo Codes', icon: Ticket },
              { id: 'ai', label: 'AI Settings', icon: Bot },
              { id: 'api', label: 'API Settings', icon: Sliders },
              { id: 'security', label: 'Security', icon: Lock },
              { id: 'logs', label: 'Logs', icon: FileText },
              { id: 'settings', label: 'Settings', icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-[#A0A0A8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-white/5 space-y-2">
          <button
            onClick={() => onNavigate('#/chat')}
            className="w-full py-2 px-3 rounded-xl border border-white/10 text-white hover:bg-white/5 text-xs flex items-center justify-center gap-2"
          >
            <span>В интерфейс чата</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleAdminLogout}
            className="w-full py-2 px-3 rounded-xl text-red-400 hover:bg-red-500/10 text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти из админки</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto max-w-6xl">
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between text-xs ${
              statusMessage.error
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.error ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs hover:underline ml-4"
            >
              Закрыть
            </button>
          </div>
        )}

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Обзор системы</h2>
              <p className="text-xs text-[#A0A0A8]">Ключевые метрики производительности и баланса</p>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10">
                <span className="text-xs text-[#A0A0A8] font-mono uppercase">Всего пользователей</span>
                <p className="text-2xl font-bold text-white mt-1">{stats.totalUsers}</p>
                <span className="text-[11px] text-emerald-400 font-mono mt-2 block">
                  Активных за 7 дней: {stats.activeUsers}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10">
                <span className="text-xs text-[#A0A0A8] font-mono uppercase">Использовано токенов</span>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.tokensUsed.toLocaleString('ru-RU')}
                </p>
                <span className="text-[11px] text-[#38BDF8] font-mono mt-2 block">
                  На счетах: {stats.currentOutstandingBalance.toLocaleString('ru-RU')}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10">
                <span className="text-xs text-[#A0A0A8] font-mono uppercase">Выдано токенов</span>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.tokensGranted.toLocaleString('ru-RU')}
                </p>
                <span className="text-[11px] text-neutral-400 font-mono mt-2 block">
                  Промокодов активировано: {stats.promoRedemptions}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10">
                <span className="text-xs text-[#A0A0A8] font-mono uppercase">Количество запросов</span>
                <p className="text-2xl font-bold text-white mt-1">{stats.totalRequests}</p>
                <span className="text-[11px] text-neutral-400 font-mono mt-2 block">
                  Всего диалогов: {stats.totalSessions}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10">
                <span className="text-xs text-[#A0A0A8] font-mono uppercase">Ошибки API</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.apiErrors}</p>
                <span className="text-[11px] text-emerald-500 font-mono mt-2 block">
                  Все сервисы работают штатно
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10">
                <span className="text-xs text-[#A0A0A8] font-mono uppercase">Промокоды</span>
                <p className="text-2xl font-bold text-white mt-1">{stats.promoCount}</p>
                <span className="text-[11px] text-[#00F0FF] font-mono mt-2 block">
                  Активных шаблонов в базе
                </span>
              </div>
            </div>

            {/* Usage Chart Simulation Block */}
            <div className="p-6 rounded-2xl bg-[#0D0D11] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Активность за последние 7 дней</h3>
                <span className="text-xs text-[#A0A0A8] font-mono">Расход токенов</span>
              </div>

              <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-white/10">
                {stats.chartData.map((item, idx) => {
                  const maxUsed = Math.max(100, ...stats.chartData.map((d) => d.tokensUsed));
                  const heightPercent = Math.max(12, Math.round((item.tokensUsed / maxUsed) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                      <span className="text-[10px] text-[#38BDF8] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.tokensUsed}
                      </span>
                      <div
                        className="w-full max-w-[38px] rounded-t-lg bg-gradient-to-t from-white/20 to-[#38BDF8] group-hover:from-white/40 group-hover:to-[#00F0FF] transition-all"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[10px] text-[#A0A0A8] font-mono">{item.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Пользователи</h2>
                <p className="text-xs text-[#A0A0A8]">База зарегистрированных аккаунтов и балансы</p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#A0A0A8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Поиск по имени/email..."
                  className="w-full bg-[#0D0D11] border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-[#0D0D11] border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-white/[0.02] border-b border-white/10 font-mono text-[#A0A0A8] uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Пользователь</th>
                    <th className="p-4">Роль</th>
                    <th className="p-4">Баланс токенов</th>
                    <th className="p-4">Использовано</th>
                    <th className="p-4">Сессий</th>
                    <th className="p-4">Регистрация</th>
                    <th className="p-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[#A0A0A8]">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-medium text-white">
                          <div>{user.username}</div>
                          {user.email && <div className="text-[10px] text-[#A0A0A8]">{user.email}</div>}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              user.role === 'admin'
                                ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                : 'bg-white/10 text-neutral-300'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-white">
                          {(user.balance ?? 0).toLocaleString('ru-RU')}
                        </td>
                        <td className="p-4 font-mono text-[#A0A0A8]">
                          {(user.total_used ?? 0).toLocaleString('ru-RU')}
                        </td>
                        <td className="p-4 font-mono">{user.sessions_count}</td>
                        <td className="p-4 text-[#A0A0A8]">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setGrantTargetUser(user)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-colors"
                          >
                            + Токены
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. PROMO CODES TAB */}
        {activeTab === 'codes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Промокоды на токены</h2>
                <p className="text-xs text-[#A0A0A8]">
                  Генерация кодов для выдачи токенов: 10K, 20K, 50K или custom
                </p>
              </div>

              <button
                onClick={() => setShowCreateCodeModal(true)}
                className="py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Создать код
              </button>
            </div>

            {/* List */}
            <div className="rounded-2xl bg-[#0D0D11] border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-white/[0.02] border-b border-white/10 font-mono text-[#A0A0A8] uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Код</th>
                    <th className="p-4">Токены</th>
                    <th className="p-4">Тип</th>
                    <th className="p-4">Использований</th>
                    <th className="p-4">Создан</th>
                    <th className="p-4">Истекает</th>
                    <th className="p-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {codes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[#A0A0A8]">
                        Промокодов пока нет
                      </td>
                    </tr>
                  ) : (
                    codes.map((promo) => (
                      <tr key={promo.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-bold text-[#38BDF8] flex items-center gap-2">
                          <span>{promo.code}</span>
                          <button
                            onClick={() => handleCopyCode(promo.code, promo.id)}
                            className="p-1 rounded hover:bg-white/10 text-[#A0A0A8] hover:text-white"
                            title="Скопировать код"
                          >
                            {copiedCodeId === promo.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="p-4 font-bold text-white">
                          +{promo.tokens.toLocaleString('ru-RU')}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-neutral-200">
                            {promo.code_type === 'single' ? 'Одноразовый' : 'Многоразовый'}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-300">
                          {promo.current_activations} / {promo.max_activations}
                        </td>
                        <td className="p-4 text-[#A0A0A8] text-[11px]">
                          {new Date(promo.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-[#A0A0A8] text-[11px]">
                          {promo.expires_at
                            ? new Date(promo.expires_at).toLocaleDateString()
                            : 'Бессрочно'}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteCode(promo.id)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-[#A0A0A8] hover:text-red-400 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. TOKENS TRANSACTIONS TAB */}
        {activeTab === 'tokens' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">История транзакций токенов</h2>
              <p className="text-xs text-[#A0A0A8]">
                Журнал начислений, списаний за генерацию и активаций промокодов
              </p>
            </div>

            <div className="rounded-2xl bg-[#0D0D11] border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-white/[0.02] border-b border-white/10 font-mono text-[#A0A0A8] uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Пользователь</th>
                    <th className="p-4">Сумма</th>
                    <th className="p-4">Тип операции</th>
                    <th className="p-4">Описание</th>
                    <th className="p-4">Время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[#A0A0A8]">
                        Транзакции отсутствуют
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-medium text-white">{tx.username || tx.user_id}</td>
                        <td className="p-4 font-mono font-bold">
                          <span className={tx.amount >= 0 ? 'text-emerald-400' : 'text-neutral-400'}>
                            {tx.amount > 0 ? `+${tx.amount.toLocaleString('ru-RU')}` : tx.amount.toLocaleString('ru-RU')}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-[#38BDF8]">{tx.type}</td>
                        <td className="p-4 text-[#A0A0A8]">{tx.description}</td>
                        <td className="p-4 font-mono text-[11px] text-[#A0A0A8]">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. AI SETTINGS TAB */}
        {activeTab === 'ai' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Настройки AI-провайдера</h2>
              <p className="text-xs text-[#A0A0A8]">
                Управление моделью, API-ключами (безопасное хранение на сервере) и проверка связи
              </p>
            </div>

            {/* Provider Status Card */}
            <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A0A0A8] font-mono uppercase">Provider</span>
                <span className="font-semibold text-white">Internal AI Provider</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A0A0A8] font-mono uppercase">Model</span>
                <span className="font-mono text-[#38BDF8]">{selectedModel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A0A0A8] font-mono uppercase">API Key</span>
                <span className="font-mono text-neutral-400">
                  {aiSettings?.maskedApiKey || 'Не установлен (используется встроенный)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                <span className="text-[#A0A0A8] font-mono uppercase">API Status</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </div>
            </div>

            {/* Connection Test Button */}
            <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Тест соединения</h4>
                  <p className="text-xs text-[#A0A0A8]">Отправить тестовый пинг AI-провайдеру</p>
                </div>
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={testingAi}
                  className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingAi ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>
              </div>

              {aiTestResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1 font-mono ${
                    aiTestResult.status === 'online'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}
                >
                  <p>
                    Статус: <strong className="uppercase">{aiTestResult.status}</strong> (задержка:{' '}
                    {aiTestResult.latencyMs} мс)
                  </p>
                  <p>Провайдер: {aiTestResult.provider}</p>
                  <p className="text-neutral-300 mt-1 italic">"{aiTestResult.response}"</p>
                  {aiTestResult.error && <p className="text-red-400">Ошибка: {aiTestResult.error}</p>}
                </div>
              )}
            </div>

            {/* AI Config Form */}
            <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10 space-y-4">
              <h4 className="text-sm font-semibold text-white">Конфигурация параметров генерации</h4>

              <div>
                <label className="block text-xs font-mono text-[#A0A0A8] mb-1 uppercase">
                  Новый API-ключ (оставьте пустым, чтобы не менять)
                </label>
                <input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Вставьте новый API ключ..."
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#A0A0A8] mb-1 uppercase">
                  Модель генерации
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                >
                  <option value="auto">✨ Автоматически по ключу (Рекомендуется)</option>
                  <option value="GigaChat">Сбер GigaChat (GigaChat)</option>
                  <option value="gemini-2.5-flash">Google Gemini (gemini-2.5-flash)</option>
                  <option value="gpt-4o-mini">OpenAI (gpt-4o-mini)</option>
                  <option value="grokson-v1">Grokson Neural Core (Встроенный)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#A0A0A8] mb-1 uppercase">
                    Temperature ({temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#A0A0A8] mb-1 uppercase">
                    Max Tokens ({maxTokens})
                  </label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                    className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#A0A0A8] mb-1 uppercase">
                  Системный промпт (System Persona)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[#050505] border border-white/15 rounded-xl p-3 text-xs text-white resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveAiSettings}
                className="py-2.5 px-5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all cursor-pointer"
              >
                Сохранить настройки AI
              </button>
            </div>
          </div>
        )}

        {/* 6. API & SECURITY & SETTINGS TAB */}
        {(activeTab === 'api' || activeTab === 'security' || activeTab === 'settings') && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Безопасность и API</h2>
              <p className="text-xs text-[#A0A0A8]">
                Параметры безопасности серверной изоляции, CORS и лимитов
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A8]">CORS Политика</span>
                <span className="font-mono text-emerald-400">GitHub Pages Permissive</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A8]">Защита API-ключа</span>
                <span className="font-mono text-emerald-400">Server-Side Only (100% Изолировано)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A8]">Rate Limiting</span>
                <span className="font-mono text-white">60 req/min (Защита от флуда)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A8]">Длительность сессии</span>
                <span className="font-mono text-white">30 дней (автоматическая ротация)</span>
              </div>
            </div>

            {/* Quick change admin password (no manual hashing required!) */}
            <div className="p-5 rounded-2xl bg-[#0D0D11] border border-white/10 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-white">Смена пароля администратора</h4>
                <p className="text-xs text-[#A0A0A8] mt-0.5">
                  Сервер автоматически создаст надёжный криптографический хеш (PBKDF2-SHA512). Никаких ручных расчетов и переменных окружения!
                </p>
              </div>

              <form onSubmit={handleChangeAdminPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-[#A0A0A8] mb-1 uppercase">
                    Новый пароль
                  </label>
                  <input
                    type="password"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Введите новый пароль (минимум 6 знаков)..."
                    className="w-full bg-[#050505] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                {passwordChangeStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      passwordChangeStatus.isError
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {passwordChangeStatus.isError ? (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <span>{passwordChangeStatus.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPassword || !adminNewPassword}
                  className="py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Обновить пароль
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 7. LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Журнал действий администратора</h2>
              <p className="text-xs text-[#A0A0A8]">Аудит событий и изменений в системе</p>
            </div>

            <div className="rounded-2xl bg-[#0D0D11] border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-white/[0.02] border-b border-white/10 font-mono text-[#A0A0A8] uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Действие</th>
                    <th className="p-4">Подробности</th>
                    <th className="p-4">IP</th>
                    <th className="p-4">Время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-[#A0A0A8]">
                        Журнал пуст
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-bold text-[#38BDF8]">{log.action}</td>
                        <td className="p-4 text-white font-sans">{log.details}</td>
                        <td className="p-4 text-[#A0A0A8]">{log.ip || '127.0.0.1'}</td>
                        <td className="p-4 text-[#A0A0A8] text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Create Promo Code */}
      {showCreateCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0D0D11] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Создание промокода</h3>

            <form onSubmit={handleCreatePromoCode} className="space-y-4 text-xs">
              {/* Preset token amounts */}
              <div>
                <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">
                  Количество токенов
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[10000, 20000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setNewCodeForm({ ...newCodeForm, tokens: amt })}
                      className={`py-1.5 px-2 rounded-lg font-mono border text-center transition-colors ${
                        newCodeForm.tokens === amt
                          ? 'bg-white text-black border-white'
                          : 'border-white/10 text-white hover:bg-white/5'
                      }`}
                    >
                      {amt / 1000}K
                    </button>
                  ))}
                  <input
                    type="number"
                    value={newCodeForm.tokens}
                    onChange={(e) =>
                      setNewCodeForm({ ...newCodeForm, tokens: parseInt(e.target.value, 10) || 0 })
                    }
                    placeholder="Custom"
                    className="py-1.5 px-2 rounded-lg bg-[#050505] border border-white/15 text-white font-mono text-center"
                  />
                </div>
              </div>

              {/* Code type */}
              <div>
                <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">Тип кода</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewCodeForm({ ...newCodeForm, codeType: 'single', maxActivations: 1 })
                    }
                    className={`flex-1 py-2 rounded-lg border transition-colors ${
                      newCodeForm.codeType === 'single'
                        ? 'bg-white text-black font-semibold border-white'
                        : 'border-white/10 text-[#A0A0A8]'
                    }`}
                  >
                    Одноразовый
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewCodeForm({ ...newCodeForm, codeType: 'multi', maxActivations: 100 })
                    }
                    className={`flex-1 py-2 rounded-lg border transition-colors ${
                      newCodeForm.codeType === 'multi'
                        ? 'bg-white text-black font-semibold border-white'
                        : 'border-white/10 text-[#A0A0A8]'
                    }`}
                  >
                    Многоразовый
                  </button>
                </div>
              </div>

              {newCodeForm.codeType === 'multi' && (
                <div>
                  <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">
                    Максимум активаций
                  </label>
                  <input
                    type="number"
                    value={newCodeForm.maxActivations}
                    onChange={(e) =>
                      setNewCodeForm({
                        ...newCodeForm,
                        maxActivations: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">
                  Срок действия (в днях, оставьте пустым для бессрочного)
                </label>
                <input
                  type="number"
                  value={newCodeForm.expiresDays}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, expiresDays: e.target.value })}
                  placeholder="Например: 30"
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">
                  Свой код (необязательно, формат: GROK-XXXX-XXXX)
                </label>
                <input
                  type="text"
                  value={newCodeForm.customCode}
                  onChange={(e) =>
                    setNewCodeForm({ ...newCodeForm, customCode: e.target.value.toUpperCase() })
                  }
                  placeholder="Генерируется автоматически"
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCodeModal(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-[#A0A0A8]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-white text-black font-semibold hover:bg-neutral-200"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Grant Tokens to User */}
      {grantTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0D0D11] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-white">
              Начисление токенов: {grantTargetUser.username}
            </h3>

            <form onSubmit={handleGrantTokens} className="space-y-4">
              <div>
                <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">
                  Количество токенов
                </label>
                <input
                  type="number"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-white font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-[#A0A0A8] mb-1 font-mono uppercase">Причина / Примечание</label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGrantTargetUser(null)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-[#A0A0A8]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-white text-black font-semibold hover:bg-neutral-200"
                >
                  Начислить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
