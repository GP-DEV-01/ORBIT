import { create } from 'zustand'
import { PortfolioItem, Quote } from '@/types'

// Always select fields individually — object selector + shallow causes "getServerSnapshot must be cached" in Next.js 16.
// See CLAUDE.md for details.

export type FeedStatus = 'connecting' | 'live' | 'paused' | 'error'

interface PortfolioStore {
  items: PortfolioItem[]
  quotes: Record<string, Quote>
  feedStatus: FeedStatus
  lastUpdate: number | null
  setItems: (items: PortfolioItem[]) => void
  addItem: (item: PortfolioItem) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<PortfolioItem>) => void
  updateQuote: (symbol: string, quote: Quote) => void
  updateQuotes: (quotes: Record<string, Quote>) => void
  setFeedStatus: (status: FeedStatus, lastUpdate?: number) => void
}

export const usePortfolioStore = create<PortfolioStore>((set) => ({
  items: [],
  quotes: {},
  feedStatus: 'connecting',
  lastUpdate: null,
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  updateItem: (id, patch) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),
  updateQuote: (symbol, quote) =>
    set((state) => ({ quotes: { ...state.quotes, [symbol]: quote } })),
  updateQuotes: (quotes) =>
    set((state) => ({ quotes: { ...state.quotes, ...quotes } })),
  setFeedStatus: (feedStatus, lastUpdate) =>
    set((state) => ({ feedStatus, lastUpdate: lastUpdate ?? state.lastUpdate })),
}))
