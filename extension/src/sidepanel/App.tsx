import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import LoginForm from './components/LoginForm';
import NoteGenerator from './components/NoteGenerator';
import ResultDisplay from './components/ResultDisplay';
import Settings from './components/Settings';
import ThemeSwitcher from './components/ThemeSwitcher';
import { type GeneratedNote } from '@/shared/schemas';
import { api } from '@/shared/api';

type View = 'generator' | 'result' | 'settings';
type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

// Poll every 10 seconds when waiting for email verification
const VERIFICATION_POLL_INTERVAL = 10 * 1000;

function AppContent() {
  const { user, isLoading, login, register, logout, refreshUser } = useAuth();
  const [view, setView] = useState<View>('generator');
  const [generatedNote, setGeneratedNote] = useState<GeneratedNote | null>(null);
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');

  // Reset view when logging out
  useEffect(() => {
    if (!user) {
      setView('generator');
      setGeneratedNote(null);
      setResendStatus('idle');
    }
  }, [user]);

  // Poll for email verification status when user hasn't verified
  useEffect(() => {
    if (!user || user.emailVerified !== false) {
      return;
    }

    const pollVerification = async () => {
      const refreshedUser = await refreshUser();
      if (refreshedUser?.emailVerified) {
        // User verified - polling will stop automatically since condition no longer met
        setResendStatus('idle');
      }
    };

    const intervalId = setInterval(pollVerification, VERIFICATION_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user, user?.emailVerified, refreshUser]);

  const handleResendVerification = async () => {
    if (!user?.email || resendStatus === 'sending') return;

    setResendStatus('sending');
    try {
      await api.resendVerificationEmail(user.email);
      setResendStatus('sent');
    } catch (err) {
      // Show sent even on most errors to prevent enumeration
      if (err instanceof Error && err.message.includes('Too many')) {
        setResendStatus('error');
      } else {
        setResendStatus('sent');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="app-container flex items-center justify-center flex-1">
        <div className="loading-indicator flex flex-col items-center gap-4">
          <div className="loading-orb" />
          <span className="text-sm opacity-70">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={login} onRegister={register} />;
  }

  const handleNoteGenerated = (note: GeneratedNote) => {
    setGeneratedNote(note);
    setView('result');
  };

  const handleBack = () => {
    setView('generator');
  };

  return (
    <div className="app-container flex flex-col flex-1">
      {/* Header */}
      <header className="app-header flex items-center justify-between px-4 py-3">
        <h1 className="app-title text-lg font-semibold">FlashNote</h1>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            onClick={() => setView(view === 'settings' ? 'generator' : 'settings')}
            className="icon-btn p-2 rounded-md"
            title="Settings"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Email verification banner */}
      {user && user.emailVerified === false && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 text-sm">
              <p className="text-amber-800 dark:text-amber-200 font-medium">Verify your email</p>
              <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                Check your email for a verification link to enable note generation.
              </p>
              <div className="mt-2">
                {resendStatus === 'idle' && (
                  <button
                    onClick={handleResendVerification}
                    className="text-amber-800 dark:text-amber-200 underline hover:no-underline text-xs font-medium"
                  >
                    Resend verification email
                  </button>
                )}
                {resendStatus === 'sending' && (
                  <span className="text-amber-700 dark:text-amber-300 text-xs">Sending...</span>
                )}
                {resendStatus === 'sent' && (
                  <span className="text-green-700 dark:text-green-400 text-xs">Verification email sent! Check your inbox.</span>
                )}
                {resendStatus === 'error' && (
                  <span className="text-red-700 dark:text-red-400 text-xs">Too many attempts. Please try again later.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div key={view} className="animate-fade-in">
          {view === 'settings' && <Settings user={user} onLogout={logout} />}
          {view === 'generator' && <NoteGenerator onNoteGenerated={handleNoteGenerated} />}
          {view === 'result' && generatedNote && (
            <ResultDisplay note={generatedNote} onBack={handleBack} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
