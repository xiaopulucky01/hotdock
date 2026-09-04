import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { platformApi } from '../api'
import type { RoleRecord } from '../api/types'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

export function RbacPage() {
  const qc = useQueryClient()
  const [module, setModule] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<unknown>(null)

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: platformApi.listRoles,
  })
  const permsQuery = useQuery({
    queryKey: ['permissions', module],
    queryFn: () => platformApi.listPermissions(module || undefined),
  })
  const allPermsQuery = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => platformApi.listPermissions(),
  })

  const roles = rolesQuery.data ?? []
  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  )

  useEffect(() => {
    if (!roles.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !roles.some((r) => r.id === selectedId)) {
      setSelectedId(roles[0].id)
    }
  }, [roles, selectedId])

  useEffect(() => {
    if (!selected) return
    setEditName(selected.name)
    setSelectedPerms([...selected.permissionCodes])
  }, [selected])

  const createMut = useMutation({
    mutationFn: () =>
      platformApi.createRole({
        code: newCode.trim(),
        name: newName.trim(),
        permissionCodes: [],
      }),
    onSuccess: (role) => {
      setNewCode('')
      setNewName('')
      setError(null)
      setSelectedId(role.id)
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (err) => setError(err),
  })

  const updateMut = useMutation({
    mutationFn: (role: RoleRecord) =>
      platformApi.updateRole(role.id, {
        name: editName.trim(),
        permissionCodes: selectedPerms,
      }),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (err) => setError(err),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => platformApi.deleteRole(id),
    onSuccess: () => {
      setError(null)
      setSelectedId(null)
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (err) => setError(err),
  })

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!newCode.trim() || !newName.trim()) return
    createMut.mutate()
  }

  function togglePerm(code: string) {
    setSelectedPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  function toggleWildcard() {
    setSelectedPerms((prev) =>
      prev.includes('*') ? prev.filter((c) => c !== '*') : ['*', ...prev.filter((c) => c !== '*')],
    )
  }

  const dirty =
    !!selected &&
    (editName.trim() !== selected.name ||
      [...selectedPerms].sort().join(',') !==
        [...selected.permissionCodes].sort().join(','))

  const assignablePerms = allPermsQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="角色权限"
        description="创建角色、编辑名称，并为角色勾选权限（系统角色不可删除）"
      />
      <ErrorBanner error={rolesQuery.error ?? permsQuery.error ?? error} />

      <form className="card card-pad" onSubmit={onCreate} style={{ marginBottom: '1rem' }}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="roleCode">新角色编码</label>
            <input
              id="roleCode"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="editor"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="roleName">名称</label>
            <input
              id="roleName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="编辑者"
              required
            />
          </div>
        </div>
        <button className="btn" type="submit" disabled={createMut.isPending}>
          创建角色
        </button>
      </form>

      <div className="grid-2">
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <strong>角色</strong>
          </div>
          {rolesQuery.isLoading ? (
            <LoadingBlock />
          ) : roles.length === 0 ? (
            <EmptyState>暂无角色</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>编码</th>
                    <th>名称</th>
                    <th>权限数</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{
                        cursor: 'pointer',
                        background:
                          r.id === selectedId
                            ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                            : undefined,
                      }}
                    >
                      <td className="mono">{r.code}</td>
                      <td>
                        {r.name}
                        {r.system ? <span className="muted"> · 系统</span> : null}
                      </td>
                      <td className="mono">{r.permissionCodes.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <strong>编辑角色</strong>
          </div>
          {!selected ? (
            <EmptyState>请选择左侧角色</EmptyState>
          ) : (
            <div className="card-pad">
              <div className="field">
                <label htmlFor="editName">名称</label>
                <input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="field">
                <label>ID</label>
                <div className="mono muted" style={{ fontSize: '0.8rem' }}>
                  {selected.id}
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '0.45rem',
                  }}
                >
                  <strong style={{ fontSize: '0.9rem' }}>权限赋权</strong>
                  <label
                    className="muted"
                    style={{
                      display: 'inline-flex',
                      gap: '0.35rem',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes('*')}
                      onChange={toggleWildcard}
                    />
                    全部权限 (*)
                  </label>
                </div>

                {allPermsQuery.isLoading ? (
                  <LoadingBlock />
                ) : (
                  <div
                    style={{
                      maxHeight: 280,
                      overflow: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.5rem 0.65rem',
                    }}
                  >
                    {assignablePerms.map((p) => (
                      <label
                        key={p.code}
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'flex-start',
                          padding: '0.3rem 0',
                          cursor: 'pointer',
                          opacity: selectedPerms.includes('*') ? 0.55 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedPerms.includes('*') ||
                            selectedPerms.includes(p.code)
                          }
                          disabled={selectedPerms.includes('*')}
                          onChange={() => togglePerm(p.code)}
                        />
                        <span>
                          <span className="mono" style={{ fontSize: '0.78rem' }}>
                            {p.code}
                          </span>
                          <span className="muted" style={{ marginLeft: 6 }}>
                            {p.name}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="btn-row">
                <button
                  className="btn"
                  type="button"
                  disabled={!dirty || updateMut.isPending}
                  onClick={() => updateMut.mutate(selected)}
                >
                  保存变更
                </button>
                {!selected.system ? (
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (confirm(`确认删除角色「${selected.code}」？`)) {
                        deleteMut.mutate(selected.id)
                      }
                    }}
                  >
                    删除角色
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <strong>权限目录</strong>
          <div className="field" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
            <label htmlFor="moduleFilter">按模块过滤</label>
            <input
              id="moduleFilter"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="ai-chat / platform / demo"
            />
          </div>
        </div>
        {permsQuery.isLoading ? (
          <LoadingBlock />
        ) : (permsQuery.data?.length ?? 0) === 0 ? (
          <EmptyState>暂无权限</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>编码</th>
                  <th>名称</th>
                  <th>模块</th>
                </tr>
              </thead>
              <tbody>
                {permsQuery.data!.map((p) => (
                  <tr key={p.code}>
                    <td className="mono">{p.code}</td>
                    <td>{p.name}</td>
                    <td className="mono">{p.module ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
