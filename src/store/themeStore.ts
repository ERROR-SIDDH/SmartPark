import { create } from 'zustand';

interface ThemeState {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
    theme: 'dark',
    toggleTheme: () =>
        set((state) => {
            const next = state.theme === 'dark' ? 'light' : 'dark';
            if (typeof document !== 'undefined') {
                document.documentElement.classList.toggle('dark', next === 'dark');
            }
            return { theme: next };
        }),
    setTheme: (theme) => {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', theme === 'dark');
        }
        set({ theme });
    },
}));
