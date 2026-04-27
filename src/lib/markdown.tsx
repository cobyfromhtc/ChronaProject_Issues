import React from 'react'

// Discord-style Markdown parser for chat messages
// Supports all Discord markdown features:
// - **bold**, *italic*, ***bold italic***
// - __underline__, __*underline italic*__, __**underline bold**__, __***underline bold italic***__
// - ~~strikethrough~~
// - `inline code`, ```code blocks```
// - > blockquotes, >>> multi-line blockquotes
// - ||spoilers||
// - # headings (##, ###)
// - [links](url)
// - Escape character: \
// - Lists: - item, * item, 1. item

export interface MarkdownToken {
  type: 'text' | 'bold' | 'italic' | 'boldItalic' | 'strikethrough' | 'underline' |
        'underlineItalic' | 'underlineBold' | 'underlineBoldItalic' |
        'inlineCode' | 'codeBlock' | 'blockquote' | 'multiBlockquote' | 
        'spoiler' | 'heading' | 'link' | 'escape' | 'list' | 'linebreak'
  content: string
  language?: string // for code blocks
  level?: number // for headings (1-3)
  listType?: 'ordered' | 'unordered'
  listItems?: string[]
  children?: MarkdownToken[] // for nested formatting
}

export interface ParsedMarkdown {
  tokens: MarkdownToken[]
}

// Check if a pattern is at the start of a line (for block-level elements)
function isAtLineStart(text: string, position: number): boolean {
  if (position === 0) return true
  const beforeText = text.slice(0, position)
  return beforeText.endsWith('\n') || beforeText === ''
}

// Parse markdown text into tokens
export function parseMarkdown(text: string): MarkdownToken[] {
  if (!text) return []
  
  const tokens: MarkdownToken[] = []
  let remaining = text
  
  // Process line by line for block-level elements
  while (remaining.length > 0) {
    let matched = false
    
    // ==================== CODE BLOCK (must be first to prevent inner parsing) ====================
    // Code block with language: ```lang\ncode```
    const codeBlockMatch = remaining.match(/^```(\w*)\n?([\s\S]*?)```/)
    if (codeBlockMatch) {
      tokens.push({
        type: 'codeBlock',
        content: codeBlockMatch[2] || '',
        language: codeBlockMatch[1] || undefined
      })
      remaining = remaining.slice(codeBlockMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== MULTI-LINE BLOCKQUOTE ====================
    // >>> followed by everything until end or another block
    const multiBlockquoteMatch = remaining.match(/^>>>\s+([\s\S]*?)(?=\n\n|\n$|$)/)
    if (multiBlockquoteMatch) {
      tokens.push({
        type: 'multiBlockquote',
        content: multiBlockquoteMatch[1].trim()
      })
      remaining = remaining.slice(multiBlockquoteMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== SINGLE-LINE BLOCKQUOTE ====================
    // > text (only at start of line)
    const blockquoteMatch = remaining.match(/^>\s([^\n]*)/)
    if (blockquoteMatch) {
      tokens.push({
        type: 'blockquote',
        content: blockquoteMatch[1]
      })
      remaining = remaining.slice(blockquoteMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== HEADING ====================
    // # text, ## text, ### text (only at start of line)
    const headingMatch = remaining.match(/^(#{1,3})\s([^\n]*)/)
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        content: headingMatch[2],
        level: headingMatch[1].length
      })
      remaining = remaining.slice(headingMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== LISTS ====================
    // Unordered: - item or * item
    // Ordered: 1. item
    const listMatch = remaining.match(/^([\s]*)([-*])\s([^\n]*(?:\n\s+\S[^\n]*)*)/)
    const orderedListMatch = remaining.match(/^([\s]*)(\d+)\.\s([^\n]*(?:\n\s+\S[^\n]*)*)/)
    
    if (listMatch) {
      tokens.push({
        type: 'list',
        content: listMatch[3],
        listType: 'unordered'
      })
      remaining = remaining.slice(listMatch[0].length)
      matched = true
      continue
    }
    
    if (orderedListMatch) {
      tokens.push({
        type: 'list',
        content: orderedListMatch[3],
        listType: 'ordered'
      })
      remaining = remaining.slice(orderedListMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== LINE BREAK ====================
    if (remaining.startsWith('\n')) {
      tokens.push({ type: 'linebreak', content: '\n' })
      remaining = remaining.slice(1)
      matched = true
      continue
    }
    
    // If no block-level element matched, parse inline elements
    if (!matched) {
      // Find the next newline or end of inline content
      const nextNewline = remaining.indexOf('\n')
      const lineContent = nextNewline === -1 ? remaining : remaining.slice(0, nextNewline)
      
      const inlineTokens = parseInlineMarkdown(lineContent)
      tokens.push(...inlineTokens)
      
      remaining = nextNewline === -1 ? '' : remaining.slice(nextNewline)
    }
  }
  
  return mergeTextTokens(tokens)
}

// Merge consecutive text tokens
function mergeTextTokens(tokens: MarkdownToken[]): MarkdownToken[] {
  const result: MarkdownToken[] = []
  
  for (const token of tokens) {
    const lastToken = result[result.length - 1]
    if (lastToken?.type === 'text' && token.type === 'text') {
      lastToken.content += token.content
    } else {
      result.push(token)
    }
  }
  
  return result
}

// Parse inline markdown (within a line)
function parseInlineMarkdown(text: string): MarkdownToken[] {
  const tokens: MarkdownToken[] = []
  let remaining = text
  let i = 0
  
  while (remaining.length > 0 && i < 10000) {
    i++
    let matched = false
    
    // ==================== ESCAPE CHARACTER ====================
    if (remaining.startsWith('\\')) {
      // Escape the next character
      if (remaining.length > 1) {
        tokens.push({ type: 'text', content: remaining[1] })
        remaining = remaining.slice(2)
        matched = true
        continue
      } else {
        tokens.push({ type: 'text', content: '\\' })
        remaining = ''
        break
      }
    }
    
    // ==================== COMBINED FORMATTING (Discord-style) ====================
    // Order matters: most specific first
    
    // __***underline bold italic***__
    const underlineBoldItalicMatch = remaining.match(/^__?\*\*\*(.+?)\*\*\*__?/)
    if (underlineBoldItalicMatch) {
      tokens.push({ type: 'underlineBoldItalic', content: underlineBoldItalicMatch[1] })
      remaining = remaining.slice(underlineBoldItalicMatch[0].length)
      matched = true
      continue
    }
    
    // __**underline bold**__
    const underlineBoldMatch = remaining.match(/^__?\*\*(.+?)\*\*__?/)
    if (underlineBoldMatch) {
      tokens.push({ type: 'underlineBold', content: underlineBoldMatch[1] })
      remaining = remaining.slice(underlineBoldMatch[0].length)
      matched = true
      continue
    }
    
    // __*underline italic*__
    const underlineItalicMatch = remaining.match(/^__?\*(.+?)\*__?/)
    if (underlineItalicMatch) {
      tokens.push({ type: 'underlineItalic', content: underlineItalicMatch[1] })
      remaining = remaining.slice(underlineItalicMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== STANDARD FORMATTING ====================
    
    // ***bold italic***
    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/)
    if (boldItalicMatch) {
      tokens.push({ type: 'boldItalic', content: boldItalicMatch[1] })
      remaining = remaining.slice(boldItalicMatch[0].length)
      matched = true
      continue
    }
    
    // **bold**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      tokens.push({ type: 'bold', content: boldMatch[1] })
      remaining = remaining.slice(boldMatch[0].length)
      matched = true
      continue
    }
    
    // __underline__
    const underlineMatch = remaining.match(/^__(.+?)__/)
    if (underlineMatch) {
      tokens.push({ type: 'underline', content: underlineMatch[1] })
      remaining = remaining.slice(underlineMatch[0].length)
      matched = true
      continue
    }
    
    // *italic* or _italic_
    const italicMatch = remaining.match(/^\*([^*]+?)\*/)
    const italicUnderscoreMatch = remaining.match(/^_([^_]+?)_/)
    
    if (italicMatch) {
      tokens.push({ type: 'italic', content: italicMatch[1] })
      remaining = remaining.slice(italicMatch[0].length)
      matched = true
      continue
    }
    
    if (italicUnderscoreMatch) {
      tokens.push({ type: 'italic', content: italicUnderscoreMatch[1] })
      remaining = remaining.slice(italicUnderscoreMatch[0].length)
      matched = true
      continue
    }
    
    // ~~strikethrough~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/)
    if (strikeMatch) {
      tokens.push({ type: 'strikethrough', content: strikeMatch[1] })
      remaining = remaining.slice(strikeMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== CODE (must be after other patterns to avoid conflicts) ====================
    
    // `inline code`
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/)
    if (inlineCodeMatch) {
      tokens.push({ type: 'inlineCode', content: inlineCodeMatch[1] })
      remaining = remaining.slice(inlineCodeMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== SPOILER ====================
    // ||spoiler||
    const spoilerMatch = remaining.match(/^\|\|(.+?)\|\|/)
    if (spoilerMatch) {
      tokens.push({ type: 'spoiler', content: spoilerMatch[1] })
      remaining = remaining.slice(spoilerMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== LINK ====================
    // [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      tokens.push({ type: 'link', content: linkMatch[1], url: linkMatch[2] } as MarkdownToken)
      remaining = remaining.slice(linkMatch[0].length)
      matched = true
      continue
    }
    
    // ==================== NO MATCH - ADD AS TEXT ====================
    if (!matched) {
      // Find the next special character or end of string
      const nextSpecial = remaining.search(/[\\*_~`>#\[\|]/)
      
      if (nextSpecial === -1) {
        tokens.push({ type: 'text', content: remaining })
        break
      } else if (nextSpecial === 0) {
        // Special character at start but didn't match any pattern
        tokens.push({ type: 'text', content: remaining[0] })
        remaining = remaining.slice(1)
      } else {
        tokens.push({ type: 'text', content: remaining.slice(0, nextSpecial) })
        remaining = remaining.slice(nextSpecial)
      }
    }
  }
  
  return tokens
}

// Render parsed tokens to React elements
export function renderMarkdownTokens(
  tokens: MarkdownToken[],
  keyPrefix: string = 'md'
): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`
    
    switch (token.type) {
      case 'text':
        return <span key={key}>{token.content}</span>
        
      case 'linebreak':
        return <br key={key} />
        
      case 'bold':
        return <strong key={key} className="font-bold text-white">{token.content}</strong>
        
      case 'italic':
        return <em key={key} className="italic">{token.content}</em>
        
      case 'boldItalic':
        return <strong key={key} className="font-bold italic text-white">{token.content}</strong>
        
      case 'underline':
        return <u key={key} className="underline">{token.content}</u>
        
      case 'underlineBold':
        return <u key={key} className="underline font-bold text-white">{token.content}</u>
        
      case 'underlineItalic':
        return <u key={key} className="underline italic">{token.content}</u>
        
      case 'underlineBoldItalic':
        return <u key={key} className="underline font-bold italic text-white">{token.content}</u>
        
      case 'strikethrough':
        return <del key={key} className="line-through text-gray-400">{token.content}</del>
        
      case 'inlineCode':
        return (
          <code 
            key={key} 
            className="bg-[#2f3136] text-[#e0e1e5] px-1.5 py-0.5 rounded text-sm font-mono"
          >
            {token.content}
          </code>
        )
        
      case 'codeBlock':
        return (
          <pre 
            key={key} 
            className="bg-[#2f3136] text-[#e0e1e5] p-3 rounded-md my-1 overflow-x-auto font-mono text-sm"
          >
            {token.language && (
              <div className="text-xs text-[#b9bbbe] mb-2 border-b border-[#40444b] pb-2">
                {token.language}
              </div>
            )}
            <code>{token.content}</code>
          </pre>
        )
        
      case 'blockquote':
        return (
          <blockquote 
            key={key} 
            className="border-l-4 border-[#5865f2] pl-3 my-1 text-[#dcddde] bg-[#2f3136]/50 py-1 rounded-r"
          >
            {token.content}
          </blockquote>
        )
        
      case 'multiBlockquote':
        return (
          <blockquote 
            key={key} 
            className="border-l-4 border-[#5865f2] pl-3 my-1 text-[#dcddde] bg-[#2f3136]/50 py-2 rounded-r whitespace-pre-wrap"
          >
            {token.content}
          </blockquote>
        )
        
      case 'spoiler':
        return (
          <Spoiler key={key} content={token.content} />
        )
        
      case 'heading':
        const headingClasses: Record<number, string> = {
          1: 'text-2xl font-bold my-2 text-white',
          2: 'text-xl font-bold my-1.5 text-white',
          3: 'text-lg font-bold my-1 text-white'
        }
        const HeadingComponent = token.level === 1 ? 'h1' : token.level === 2 ? 'h2' : 'h3'
        return React.createElement(
          HeadingComponent,
          {
            key,
            className: headingClasses[token.level as 1 | 2 | 3] || 'font-bold my-1'
          },
          token.content
        )
        
      case 'link':
        return (
          <a 
            key={key} 
            href={(token as any).url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#00aff4] hover:underline"
          >
            {token.content}
          </a>
        )
        
      case 'list':
        const ListComponent = token.listType === 'ordered' ? 'ol' : 'ul'
        return React.createElement(
          ListComponent,
          {
            key,
            className: token.listType === 'ordered' 
              ? 'list-decimal list-inside my-1 text-[#dcddde]' 
              : 'list-disc list-inside my-1 text-[#dcddde]'
          },
          <li>{token.content}</li>
        )
        
      default:
        return <span key={key}>{token.content}</span>
    }
  })
}

// Spoiler component with click-to-reveal
function Spoiler({ content }: { content: string }) {
  const [revealed, setRevealed] = React.useState(false)
  
  return (
    <span 
      className={`inline-block rounded px-1 cursor-pointer select-none transition-all duration-200 ${
        revealed 
          ? 'bg-[#2f3136] text-[#dcddde]' 
          : 'bg-[#202225] text-[#202225] hover:bg-[#2f3136]/50'
      }`}
      onClick={() => setRevealed(!revealed)}
    >
      {content}
    </span>
  )
}

// Combine markdown parsing with mention parsing
export function parseMessageWithMarkdown(
  content: string,
  mentionUsernames: string[] = []
): React.ReactNode[] {
  if (!content) return []
  
  // First handle mentions (they shouldn't be markdown-parsed)
  const mentionRegex = /@(\w+)/g
  const parts: Array<{ type: 'mention' | 'text'; content: string; valid?: boolean }> = []
  let lastIndex = 0
  
  content.replace(mentionRegex, (match, username, offset) => {
    // Add text before this mention
    if (offset > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, offset) })
    }
    // Add the mention
    parts.push({ 
      type: 'mention', 
      content: username,
      valid: mentionUsernames.includes(username)
    })
    lastIndex = offset + match.length
    return match
  })
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) })
  }
  
  // If no mentions found, just parse the whole thing as markdown
  if (parts.length === 0) {
    const tokens = parseMarkdown(content)
    return renderMarkdownTokens(tokens)
  }
  
  // Render parts
  const result: React.ReactNode[] = []
  let keyIndex = 0
  
  parts.forEach((part) => {
    if (part.type === 'mention') {
      result.push(
        <span
          key={`mention-${keyIndex++}`}
          className={`font-medium ${
            part.valid 
              ? 'text-[#5865f2] bg-[#5865f2]/20 px-1 rounded hover:bg-[#5865f2]/30 cursor-pointer' 
              : 'text-[#72767d]'
          }`}
        >
          @{part.content}
        </span>
      )
    } else {
      // Parse this text part as markdown
      const tokens = parseMarkdown(part.content)
      result.push(...renderMarkdownTokens(tokens, `text-${keyIndex++}`))
    }
  })
  
  return result
}

// Utility function to wrap selected text with markdown syntax
export function wrapSelection(text: string, selectionStart: number, selectionEnd: number, syntax: string): { text: string; cursorOffset: number } {
  const before = text.slice(0, selectionStart)
  const selected = text.slice(selectionStart, selectionEnd)
  const after = text.slice(selectionEnd)
  
  // Handle code blocks differently
  if (syntax === '```') {
    const newText = `${before}\`\`\`\n${selected}\n\`\`\`${after}`
    return { text: newText, cursorOffset: before.length + 4 + selected.length }
  }
  
  // Handle spoilers
  if (syntax === '||') {
    const newText = `${before}||${selected}||${after}`
    return { text: newText, cursorOffset: before.length + 2 + selected.length }
  }
  
  const newText = `${before}${syntax}${selected}${syntax}${after}`
  return { text: newText, cursorOffset: before.length + syntax.length + selected.length }
}

// Markdown formatting buttons configuration
export const markdownButtons = [
  { syntax: '**', label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold' },
  { syntax: '*', label: 'I', title: 'Italic (Ctrl+I)', className: 'italic' },
  { syntax: '__', label: 'U', title: 'Underline (Ctrl+U)', className: 'underline' },
  { syntax: '~~', label: 'S', title: 'Strikethrough (Ctrl+S)', className: 'line-through' },
  { syntax: '||', label: '⬛', title: 'Spoiler', className: '' },
  { syntax: '`', label: '</>', title: 'Inline Code', className: 'font-mono text-xs' },
  { syntax: '```', label: '{}', title: 'Code Block', className: 'font-mono text-xs' },
] as const
