"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io as ClientSocket, Socket } from "socket.io-client";

interface User {
  id: string;
  email: string;
  role: "player" | "admin";
  walletId?: string;
  selfExcludedUntil?: string | null;
  cooldownUntil?: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  balance: number | null;
  setBalance: React.Dispatch<React.SetStateAction<number | null>>;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, role?: "player" | "admin") => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  apiUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const refreshBalance = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${apiUrl}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch {
      // Ignore
    }
  };

  // Socket.io Real-Time connection
  useEffect(() => {
    if (!accessToken || !user) return;

    const socket: Socket = ClientSocket(apiUrl, {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("balance_updated", (data: { balance: number }) => {
      setBalance(data.balance);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, user, apiUrl]);

  useEffect(() => {
    // Check if refresh token exists in localStorage
    const storedRefresh = localStorage.getItem("refresh_token");
    const storedUser = localStorage.getItem("user_data");

    if (storedRefresh && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        // Refresh token to get fresh access token
        fetch(`${apiUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefresh }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.accessToken && data.refreshToken) {
              setAccessToken(data.accessToken);
              localStorage.setItem("refresh_token", data.refreshToken);
            } else {
              logout();
            }
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [apiUrl]);

  // When access token changes, fetch balance
  useEffect(() => {
    if (accessToken) {
      refreshBalance();
    }
  }, [accessToken]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setAccessToken(data.accessToken);
      setUser(data.user);
      localStorage.setItem("refresh_token", data.refreshToken);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  const register = async (email: string, pass: string, role: "player" | "admin" = "player") => {
    try {
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details
          ? data.details.map((d: any) => d.message).join(", ")
          : data.error || "Registration failed";
        return { success: false, error: errorMsg };
      }

      return await login(email, pass);
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore
      }
    }
    setUser(null);
    setAccessToken(null);
    setBalance(null);
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_data");
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        balance,
        setBalance,
        isLoading,
        login,
        register,
        logout,
        refreshBalance,
        apiUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
