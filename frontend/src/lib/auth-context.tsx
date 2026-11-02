"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  profile?: {
    avatar_url: string | null;
    job_title: string | null;
    organization: string | null;
    preferred_theme: string;
    storage_used_bytes: number;
  };
  subscription?: {
    plan_tier: string;
    status: string;
    max_storage_bytes: number;
    max_file_size_mb: number;
    ai_credits_monthly: number;
    ai_credits_used: number;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data);
    } catch {
      setUser(null);
      api.clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check initial auth state
    refreshUser();

    // Check theme
    const savedTheme = localStorage.getItem("bricdoc_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("bricdoc_theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const login = async (data: { email: string; password: string }) => {
    await api.login(data);
    await refreshUser();
  };

  const register = async (data: { email: string; password: string; full_name?: string }) => {
    await api.register(data);
    await refreshUser();
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
