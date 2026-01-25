import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import LoginForm from './components/LoginForm';
import NoteGenerator from './components/NoteGenerator';
import ResultDisplay from './components/ResultDisplay';
import Settings from './components/Settings';
import ThemeSwitcher from './components/ThemeSwitcher';
import { type GeneratedNote } from '@/shared/schemas';

type View = 'generator' | 'result' | 'settings';

function AppContent() {
  const { user, isLoading, login, register, logout } = useAuth();
  const [view, setView] = useState<View>('generator');
  const [generatedNote, setGeneratedNote] = useState<GeneratedNote | null>(null);

  // Reset view when logging out
  useEffect(() => {
    if (!user) {
      setView('generator');
      setGeneratedNote(null);
    }
  }, [user]);

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
