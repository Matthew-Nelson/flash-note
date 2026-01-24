import { useTheme, type Theme } from '../context/ThemeContext';

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark-ai', label: 'Dark AI', icon: '🌙' },
  { value: 'glassmorphism', label: 'Glass', icon: '✨' },
  { value: 'gradient-accent', label: 'Gradient', icon: '🌈' },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher">
      <span className="theme-switcher-label">Theme:</span>
      <div className="theme-switcher-buttons">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`theme-switcher-btn ${theme === t.value ? 'active' : ''}`}
            title={t.label}
          >
            <span className="theme-icon">{t.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
