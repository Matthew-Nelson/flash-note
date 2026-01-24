import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'dark-ai' | 'glassmorphism' | 'gradient-accent';

const VALID_THEMES: Theme[] = ['dark-ai', 'glassmorphism', 'gradient-accent'];
const THEME_STORAGE_KEY = 'flashnote-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && VALID_THEMES.includes(value as Theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark-ai');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load saved theme from chrome.storage.local
    chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
      const saved = result[THEME_STORAGE_KEY];
      if (isValidTheme(saved)) {
        setTheme(saved);
      }
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    // Save theme and update document class (only after initial load)
    if (isLoaded) {
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
    }
    document.documentElement.className = `theme-${theme}`;
  }, [theme, isLoaded]);

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
