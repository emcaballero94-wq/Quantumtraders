import { Fragment, type ReactNode } from 'react'

// Lightweight, dependency-free renderer for M.A.N.U.'s chat replies — not a
// full Markdown engine. The model is instructed to write disciplined text
// (**bold** labels, "- " bullet lists, blank-line paragraphs, "---"
// dividers), so a tiny line-based renderer is enough to make that readable
// instead of showing literal asterisks and dashes.
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

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    const key = `line-${index}`

    if (/^(-{3,}|={3,}|━{3,})$/.test(line.trim())) {
      flushList(`${key}-flush`)
      blocks.push(<hr key={key} className="border-oracle/20 my-2" />)
      return
    }

    const bulletMatch = line.match(/^[-•]\s+(.*)/)
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1])
      return
    }
    flushList(`${key}-flush`)

    if (line.trim() === '') {
      blocks.push(<div key={key} className="h-2" aria-hidden />)
      return
    }

    blocks.push(
      <p key={key} className="leading-relaxed">
        {renderInline(line, key)}
      </p>,
    )
  })
  flushList('tail-flush')

  return <div className="space-y-0.5">{blocks}</div>
}
