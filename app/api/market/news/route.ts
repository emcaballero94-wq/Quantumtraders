/**
 * GET /api/market/news?symbols=XAUUSD,EURUSD&limit=20
 *
 * Aggregates financial news from multiple RSS feeds:
 * - ForexLive (best for forex news)
 * - Yahoo Finance RSS
 * - MarketWatch
 * - Reuters Business
 */
import { NextResponse } from 'next/server'

interface NewsItem {
  id:          string
  title:       string
  summary:     string
  url:         string
  publishedAt: string
  source:      string
  category:    'forex' | 'commodities' | 'macro' | 'crypto' | 'general'
  symbols:     string[]
}

// RSS sources — no API key needed
const RSS_FEEDS = [
  { url: 'https://www.forexlive.com/feed/news',                          source: 'ForexLive',    category: 'forex'       },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', source: 'MarketWatch',  category: 'general'     },
  { url: 'https://finance.yahoo.com/rss/topstories',                     source: 'Yahoo Finance', category: 'general'     },
  { url: 'https://www.dailyfx.com/feeds/market-news',                    source: 'DailyFX',      category: 'forex'       },
  { url: 'https://s.marketwatch.com/public/resources/documents/rss/rss_fx.xml', source: 'MarketWatch FX', category: 'forex' },
]

// Keywords to auto-detect relevant symbols in news
const SYMBOL_KEYWORDS: Record<string, string[]> = {
  XAUUSD: ['gold', 'xau', 'oro', 'bullion'],
  EURUSD: ['euro', 'eur', 'ecb', 'eurozone', 'draghui'],
  GBPUSD: ['pound', 'gbp', 'sterling', 'boe', 'bank of england', 'brexit'],
  BTCUSD: ['bitcoin', 'btc', 'crypto', 'cryptocurrency'],
  USDJPY: ['yen', 'jpy', 'boj', 'bank of japan', 'japan'],
  XAGUSD: ['silver', 'xag'],
  SP500:  ['s&p', 'sp500', 's&p 500', 'stocks', 'equities', 'nasdaq'],
  DXY:    ['dollar', 'dxy', 'usd', 'fed', 'federal reserve', 'powell'],
}

function detectSymbols(text: string): string[] {
  const lower = text.toLowerCase()
  return Object.entries(SYMBOL_KEYWORDS)
    .filter(([, keywords]) => keywords.some(k => lower.includes(k)))
    .map(([sym]) => sym)
}

function detectCategory(text: string, source: string): NewsItem['category'] {
  if (source === 'ForexLive' || source === 'DailyFX' || source.includes('FX')) return 'forex'
  const lower = text.toLowerCase()
  if (lower.includes('bitcoin') || lower.includes('crypto')) return 'crypto'
  if (lower.includes('gold') || lower.includes('silver') || lower.includes('oil')) return 'commodities'
  if (lower.includes('fed') || lower.includes('cpi') || lower.includes('gdp') || lower.includes('inflation')) return 'macro'
  return 'general'
}

function parseRSSItem(item: Element, source: string, defaultCategory: string): NewsItem | null {
  const title   = item.querySelector('title')?.textContent?.trim() ?? ''
  const link    = item.querySelector('link')?.textContent?.trim()
    || item.querySelector('link')?.getAttribute('href')
    || ''
  const desc = item.querySelector('description')?.textContent?.replace(/<[^>]*>/g, '').trim() ?? ''
  const pubDate = item.querySelector('pubDate')?.textContent?.trim()
    || item.querySelector('updated')?.textContent?.trim()
    || new Date().toISOString()

  if (!title || !link) return null

  const combined = `${title} ${desc}`
  return {
    id:          `${source}-${Buffer.from(link).toString('base64').slice(0, 16)}`,
    title,
    summary:     desc.slice(0, 200),
    url:         link,
    publishedAt: new Date(pubDate).toISOString(),
    source,
    category:    detectCategory(combined, source) as NewsItem['category'],
    symbols:     detectSymbols(combined),
  }
}

async function fetchFeed(feed: typeof RSS_FEEDS[0]): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; QuantumTraders/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      next: { revalidate: 300 }, // cache 5 min
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []

    const xml  = await res.text()
    // Server-side XML parse using DOMParser (Node.js doesn't have it, use regex fallback)
    const items = parseXMLItems(xml, feed.source)
    return items
  } catch {
    return []
  }
}

function parseXMLItems(xml: string, source: string): NewsItem[] {
  // Use regex since DOMParser is not available in Node.js
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const items: NewsItem[] = []
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 's'))
        || block.match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 's'))
      return m?.[1]?.trim() ?? ''
    }

    const title   = get('title')
    const link    = get('link') || block.match(/<link\s+href="([^"]+)"/)?.[1] || ''
    const desc    = get('description').replace(/<[^>]*>/g, '').slice(0, 200)
    const pubDate = get('pubDate') || get('dc:date') || new Date().toISOString()

    if (!title) continue

    const combined = `${title} ${desc}`
    const item: NewsItem = {
      id:          `${source}-${Math.abs(hashCode(link)).toString(16).slice(0, 12)}`,
      title,
      summary:     desc,
      url:         link,
      publishedAt: new Date(pubDate).toISOString(),
      source,
      category:    detectCategory(combined, source) as NewsItem['category'],
      symbols:     detectSymbols(combined),
    }
    items.push(item)
  }
  return items
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0
  }
  return hash
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filterSymbols = searchParams.get('symbols')?.split(',').map(s => s.toUpperCase()) ?? []
  const limit = parseInt(searchParams.get('limit') ?? '30')

  try {
    // Fetch all feeds in parallel
    const results = await Promise.allSettled(RSS_FEEDS.map(f => fetchFeed(f)))
    const allItems = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<NewsItem[]>).value)

    // Sort newest first
    allItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    // Deduplicate by title similarity
    const seen = new Set<string>()
    const deduped = allItems.filter(item => {
      const key = item.title.slice(0, 50).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Filter by symbols if requested
    const filtered = filterSymbols.length > 0
      ? deduped.filter(item => 
          item.symbols.length === 0 || // include unclassified items too
          item.symbols.some(s => filterSymbols.includes(s))
        )
      : deduped

    return NextResponse.json({
      news:  filtered.slice(0, limit),
      total: filtered.length,
      sources: RSS_FEEDS.map(f => f.source),
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message, news: [], total: 0 }, { status: 500 })
  }
}
