export function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g
  const mentions = new Set<string>()
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.add(match[1])
  }

  return Array.from(mentions)
}

export function parseMessageContent(content: string, allowedUsernames: string[] = []) {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g
  const parts: Array<{ type: 'text'; value: string } | { type: 'mention'; value: string; valid: boolean }> = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    const [fullMatch, username] = match
    const start = match.index

    if (start > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, start) })
    }

    const valid = allowedUsernames.includes(username)
    parts.push({ type: 'mention', value: username, valid })

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts
}
