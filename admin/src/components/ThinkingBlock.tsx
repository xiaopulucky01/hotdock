import { useEffect, useState } from 'react'

/** Fallback: peel <think> tags if backend did not split them yet */
export function splitEmbeddedReasoning(content: string, reasoning?: string) {
  const parts: string[] = []
  if (reasoning?.trim()) parts.push(reasoning.trim())

  let visible = content
  const tagPattern =
    /<\s*(?:think|thinking|reasoning)\s*>([\s\S]*?)<\s*\/\s*(?:think|thinking|reasoning)\s*>/gi
  visible = visible.replace(tagPattern, (_m, inner: string) => {
    const text = String(inner ?? '').trim()
    if (text) parts.push(text)
    return ''
  })

  return {
    content: visible.trim(),
    reasoning: parts.length ? parts.join('\n\n') : undefined,
  }
}

export function ThinkingBlock({
  reasoning,
  defaultOpen = false,
  pending = false,
}: {
  reasoning?: string
  defaultOpen?: boolean
  pending?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || pending)

  useEffect(() => {
    if (pending) setOpen(true)
  }, [pending])

  if (pending && !reasoning) {
    return (
      <div className="thinking-block pending">
        <div className="thinking-summary">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span>正在思考…</span>
        </div>
      </div>
    )
  }

  if (!reasoning) return null

  return (
    <div className={`thinking-block${open ? ' open' : ''}${pending ? ' pending' : ''}`}>
      <button
        type="button"
        className="thinking-summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="thinking-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <span>{pending ? '正在思考…' : '思考过程'}</span>
        <span className="thinking-meta">
          {reasoning.length > 0 ? `${reasoning.length} 字` : ''}
        </span>
      </button>
      {open ? <pre className="thinking-body">{reasoning}</pre> : null}
    </div>
  )
}
