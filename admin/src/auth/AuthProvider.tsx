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
  clearStoredSession,
  getStoredTenantId,
  getStoredToken,
  setStoredRefreshToken,
  setStoredTenantId,
  setStoredToken,
  setUnauthorizedHandler,
} from '../api/client'
import type { AuthenticatedUser } from '../api/types'

interface AuthContextValue {
  token: string | null
  user: AuthenticatedUser | null
  tenantId: string | null
  loading: boolean
  login: (username: string, password: string, tenantId?: string) => Promise<void>
  register: (input: {
    username: string
    password: string
    email?: string
    tenantId?: string
  }) => Promise<void>
  logout: () => Promise<void>
  setTenantId: (tenantId: string | null) => void
  hasPermission: (code: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [tenantId, setTenantIdState] = useState<string | null>(() =>
    getStoredTenantId(),
  )
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    clearStoredSession()
    setToken(null)
    setTenantIdState(null)
    setUser(null)
  }, [])

  const setTenantId = useCallback((id: string | null) => {
    const next = id?.trim() || null
    setStoredTenantId(next)
    setTenantIdState(next)
  }, [])

  const refreshMe = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
    if (me.tenantId) {
      setStoredTenantId(me.tenantId)
      setTenantIdState(me.tenantId)
    }
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
    async (username: string, password: string, loginTenantId?: string) => {
      const tokens = await authApi.login({
        username,
        password,
        tenantId: loginTenantId,
      })
      setStoredToken(tokens.accessToken)
      setStoredRefreshToken(tokens.refreshToken ?? null)
      if (loginTenantId) {
        setStoredTenantId(loginTenantId)
        setTenantIdState(loginTenantId)
      }
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
      tenantId,
      loading,
      login,
      register,
      logout,
      setTenantId,
      hasPermission,
    }),
    [
      token,
      user,
      tenantId,
      loading,
      login,
      register,
      logout,
      setTenantId,
      hasPermission,
    ],
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
