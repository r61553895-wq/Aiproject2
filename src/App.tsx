import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RedeemModal } from './components/RedeemModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { LandingPage } from './pages/LandingPage';
import { ChatPage } from './pages/ChatPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { User } from './types';
import { api, getAuthToken } from './api';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(window.location.hash || '#/');
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Modals
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showApiSettingsModal, setShowApiSettingsModal] = useState(false);

  // Hash-based routing listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentRoute(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (route: string) => {
    window.location.hash = route;
    setCurrentRoute(route);
  };

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoadingUser(false);
      return;
    }

    try {
      const currentUser = await api.auth.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    navigate('#/');
  };

  const handleStartChat = () => {
    if (user) {
      navigate('#/chat');
    } else {
      navigate('#/register');
    }
  };

  const renderRoute = () => {
    if (currentRoute === '#/chat') {
      return (
        <ChatPage
          user={user}
          onRefreshUser={refreshUser}
          onLogout={handleLogout}
          onNavigate={navigate}
        />
      );
    }

    if (currentRoute === '#/login') {
      return (
        <AuthPage
          initialMode="login"
          onSuccess={refreshUser}
          onNavigate={navigate}
        />
      );
    }

    if (currentRoute === '#/register') {
      return (
        <AuthPage
          initialMode="register"
          onSuccess={refreshUser}
          onNavigate={navigate}
        />
      );
    }

    if (currentRoute === '#/admin') {
      return <AdminPage onNavigate={navigate} />;
    }

    // Default: Landing Page
    return <LandingPage onStart={handleStartChat} onNavigate={navigate} />;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-[#00F0FF]/20 selection:text-white">
        {/* Navigation Bar */}
        <Navbar
          user={user}
          onOpenRedeem={() => setShowRedeemModal(true)}
          onOpenApiSettings={() => setShowApiSettingsModal(true)}
          onLogout={handleLogout}
          onNavigate={navigate}
          currentRoute={currentRoute}
        />

        {/* Dynamic Route Content */}
        <div className="flex-1 flex flex-col">
          {renderRoute()}
        </div>

        {/* Global Modals */}
        <RedeemModal
          isOpen={showRedeemModal}
          onClose={() => setShowRedeemModal(false)}
          onSuccess={async (newBalance) => {
            if (user) {
              setUser({ ...user, balance: newBalance });
            }
            await refreshUser();
          }}
        />

        <ApiSettingsModal
          isOpen={showApiSettingsModal}
          onClose={() => setShowApiSettingsModal(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
