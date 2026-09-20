import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark' | 'auto';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'wrld-theme';

function prefersDark(): MediaQueryList {
  return window.matchMedia('(prefers-color-scheme: dark)');
}

function readTheme(): Theme {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : 'auto';
}

function resolve(theme: Theme): Resolved {
  return theme === 'auto' ? (prefersDark().matches ? 'dark' : 'light') : theme;
}

/**
 * Flips between the design system's light and dark themes. The page starts
 * on "auto" (set in index.html before first paint); the first click pins an
 * explicit choice and remembers it.
 */
export function ThemeToggle() {
  const [effective, setEffective] = useState<Resolved>(() => resolve(readTheme()));

  useEffect(() => {
    const mq = prefersDark();
    const onChange = () => {
      if (readTheme() === 'auto') setEffective(resolve('auto'));
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const next: Resolved = effective === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode); the choice still applies for this page.
    }
    setEffective(next);
  }, [effective]);

  const label = effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {effective === 'dark' ? (
        <Sun size={18} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Moon size={18} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}
