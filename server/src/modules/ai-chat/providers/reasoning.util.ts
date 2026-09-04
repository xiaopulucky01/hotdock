/**
 * Split provider output into visible answer + reasoning/thinking text.
 * Supports:
 * - explicit reasoning_content / reasoning fields (DeepSeek-R1 style)
 * - <think>...</think> / <thinking>...</thinking> tags embedded in content
 */
export function splitReasoningContent(
  content: string | undefined | null,
  explicitReasoning?: string | null,
): { content: string; reasoning?: string } {
  const reasoningParts: string[] = [];
  if (explicitReasoning?.trim()) {
    reasoningParts.push(explicitReasoning.trim());
  }

  let visible = (content ?? '').trim();
  if (visible) {
    const tagPattern =
      /<\s*(?:think|thinking|reasoning)\s*>([\s\S]*?)<\s*\/\s*(?:think|thinking|reasoning)\s*>/gi;
    visible = visible.replace(tagPattern, (_match, inner: string) => {
      const text = String(inner ?? '').trim();
      if (text) reasoningParts.push(text);
      return '';
    });
    visible = visible.trim();
  }

  const reasoning =
    reasoningParts.length > 0 ? reasoningParts.join('\n\n') : undefined;

  return { content: visible, reasoning };
}
