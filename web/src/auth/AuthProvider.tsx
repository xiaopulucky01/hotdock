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
  loading: boolean
  login: (username: string, password: string, tenantId?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    clearStoredSession()
    setToken(null)
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
    if (me.tenantId) {
      setStoredTenantId(me.tenantId)
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
      if (loginTenantId) setStoredTenantId(loginTenantId)
      else if (!getStoredTenantId()) {
        // keep existing tenant if any
      }
      setToken(tokens.accessToken)
      await refreshMe()
    },
    [refreshMe],
  )

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) await authApi.logout()
    } catch {
      // ignore
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(
    () => ({ token, user, loading, login, logout }),
    [token, user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
