import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'dark-ai' | 'glassmorphism' | 'gradient-accent';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark-ai');

  useEffect(() => {
    // Load saved theme
    const saved = localStorage.getItem('flashnote-theme') as Theme | null;
    if (saved && ['dark-ai', 'glassmorphism', 'gradient-accent'].includes(saved)) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    // Save theme and update document class
    localStorage.setItem('flashnote-theme', theme);
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
