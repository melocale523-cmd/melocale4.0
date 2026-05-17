import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';

  return (
    <button
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#1C3454] border border-slate-200 dark:border-[#243F6A] hover:border-emerald-400/60 transition-all text-slate-600 dark:text-yellow-300"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
