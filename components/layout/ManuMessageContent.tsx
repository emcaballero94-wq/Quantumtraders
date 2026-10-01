import { Fragment, type ReactNode } from 'react'

// Lightweight, dependency-free renderer for M.A.N.U.'s chat replies — not a
// full Markdown engine. The model is instructed to write disciplined text
// (**bold** labels, "- " bullet lists, blank-line paragraphs, "---"
// dividers, occasional "| a | b |" tables), so a tiny line-based renderer is
// enough to make that readable instead of showing literal pipes/asterisks.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-bold text-ink-primary">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
  })
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

// A GFM separator row: only pipes, dashes, colons and spaces (e.g. "|---|:--:|").
function isTableSeparatorRow(line: string): boolean {
  return isTableRow(line) && /^[\s|:-]+$/.test(line)
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map((cell) => cell.trim())
}

export function ManuMessageContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc pl-4 space-y-1 marker:text-oracle/60">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>
        ))}
      </ul>,
    )
    listBuffer = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trimEnd()
    const key = `line-${i}`

    // Markdown table: header row, separator row, then data rows — the chat
    // panel is narrow, so this renders as a small scrollable table instead
    // of letting the raw "| a | b |" syntax wrap into unreadable garbage.
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      flushList(`${key}-flush`)
      const header = splitTableRow(line)
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitTableRow(lines[j]))
        j += 1
      }

      blocks.push(
        <div key={key} className="overflow-x-auto -mx-1">
          <table className="min-w-full text-[10px] border-collapse">
            <thead>
              <tr>
                {header.map((cell, ci) => (
                  <th
                    key={ci}
                    className="text-left font-bold text-ink-primary border-b border-oracle/30 px-2 py-1 whitespace-nowrap"
                  >
                    {renderInline(cell, `${key}-h-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? 'bg-bg-elevated/40' : undefined}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 border-b border-bg-border/50 whitespace-nowrap">
                      {renderInline(cell, `${key}-r${ri}-c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      i = j
      continue
    }

    if (/^(-{3,}|={3,}|━{3,})$/.test(line.trim())) {
      flushList(`${key}-flush`)
      blocks.push(<hr key={key} className="border-oracle/20 my-2" />)
      i += 1
      continue
    }

    const bulletMatch = line.match(/^[-•]\s+(.*)/)
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1])
      i += 1
      continue
    }
    flushList(`${key}-flush`)

    if (line.trim() === '') {
      blocks.push(<div key={key} className="h-2" aria-hidden />)
      i += 1
      continue
    }

    blocks.push(
      <p key={key} className="leading-relaxed">
        {renderInline(line, key)}
      </p>,
    )
    i += 1
  }
  flushList('tail-flush')

  return <div className="space-y-0.5">{blocks}</div>
}
