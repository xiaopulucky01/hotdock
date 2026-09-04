import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api'
import {
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
} from '../api/client'
import type { AuthenticatedUser } from '../api/types'

interface AuthContextValue {
  token: string | null
  user: AuthenticatedUser | null
  loading: boolean
  login: (username: string, password: string, tenantId?: string) => Promise<void>
  register: (input: {
    username: string
    password: string
    email?: string
    tenantId?: string
  }) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (code: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
    })
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        await refreshMe()
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [token, refreshMe, clearSession])

  const login = useCallback(
    async (username: string, password: string, tenantId?: string) => {
      const tokens = await authApi.login({ username, password, tenantId })
      setStoredToken(tokens.accessToken)
      setToken(tokens.accessToken)
      await refreshMe()
    },
    [refreshMe],
  )

  const register = useCallback(
    async (input: {
      username: string
      password: string
      email?: string
      tenantId?: string
    }) => {
      await authApi.register(input)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await authApi.logout()
      }
    } catch {
      // ignore logout network errors
    } finally {
      clearSession()
    }
  }, [clearSession])

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false
      if (user.permissions.includes('*')) return true
      return user.permissions.includes(code)
    },
    [user],
  )

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      logout,
      hasPermission,
    }),
    [token, user, loading, login, register, logout, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
