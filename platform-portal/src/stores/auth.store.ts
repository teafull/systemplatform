import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  permissions: string[];

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setAuthData: (data: Partial<AuthState>) => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      permissions: [],

      login: async (username: string, password: string) => {
        try {
          const response = await fetch('http://localhost:4000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '登录失败');
          }

          const data = await response.json();

          set({
            user: data.user,
            token: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      logout: async () => {
        const { token, refreshToken } = get();

        try {
          await fetch('http://localhost:4000/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Session-Id': sessionStorage.getItem('sessionId') || '',
            },
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            permissions: [],
          });
          sessionStorage.removeItem('sessionId');
        }
      },

      refreshTokens: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          throw new Error('没有刷新令牌');
        }

        try {
          const response = await fetch('http://localhost:4000/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            throw new Error('刷新令牌失败');
          }

          const data = await response.json();

          set({
            token: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } catch (error) {
          console.error('Refresh tokens error:', error);
          get().logout();
          throw error;
        }
      },

      setAuthData: (data: Partial<AuthState>) => {
        set(data);
      },

      hasPermission: (permission: string) => {
        const { permissions } = get();
        return permissions.includes(permission) || permissions.includes('*');
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
