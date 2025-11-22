import { create } from "zustand";

export const useThemeStore = create((set) => ({
    theme: localStorage.getItem("chat-theme") || "business",
    setTheme: (theme: any) => {
        localStorage.setItem("chat-theme", theme);
        set({ theme });
    },
}));
