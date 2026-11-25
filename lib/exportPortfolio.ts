'use client'

// Portfolio export: Excel (.xlsx with native charts), Google Sheets (clipboard + sheets.new), CSV,
// and the live links (secret-token CSV feeds for IMPORTDATA / Excel "From Web").
// Values stay in each instrument's own currency; totals are grouped per currency (no FX conversion).

import type { PortfolioItem, Quote } from '@/types'
import { supabase } from '@/lib/supabase'
import {
  buildRows, totalsByCurrency, mergeGrowth, positionHeaders, holdingsByCurrency, localDate,
  type ExportRow, type Snapshot, type GrowthPoint,
} from '@/lib/portfolioMath'

type T = (key: string) => string

function fileName(ext: string) {
  return `orbit-portfolio-${new Date().toISOString().slice(0, 10)}.${ext}`
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function rowValues(r: ExportRow) {
  return [
    r.symbol, r.name, r.type, r.isin, r.position, r.currency, r.quantity,
    r.avgPrice, r.price, r.dayChangePct, r.value, r.cost, r.pnl, r.pnlPct, r.weight,
  ]
}

// ── Growth history (recorded snapshots + estimate before the first one) ───────

async function fetchSnapshots(userId: string): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('date, currency, value, cost')
    .eq('user_id', userId)
    .order('date')
  return error ? [] : (data as Snapshot[])
}

async function fetchEstimated(rows: ExportRow[]) {
  const out: Record<string, { date: string; value: number }[]> = {}
  await Promise.all(Object.entries(holdingsByCurrency(rows)).map(async ([currency, holdings]) => {
    try {
      const r = await fetch(`/api/market/portfolio-history?holdings=${encodeURIComponent(holdings)}&range=1Y`)
      out[currency] = (await r.json()).history ?? []
    } catch {
      out[currency] = []
    }
  }))
  return out
}

export async function loadGrowth(rows: ExportRow[], userId: string | null): Promise<GrowthPoint[]> {
  const [snapshots, estimated] = await Promise.all([
    userId ? fetchSnapshots(userId) : Promise.resolve([]),
    fetchEstimated(rows),
  ])
  // Today's live totals are a real data point even if the dashboard hasn't recorded them yet
  const today = localDate()
  const live = Object.entries(totalsByCurrency(rows)).map(([currency, v]) => ({ date: today, currency, value: v.value, cost: v.cost }))
  return mergeGrowth([...snapshots.filter(s => s.date !== today), ...live], estimated)
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export async function exportExcel(
  items: PortfolioItem[],
  quotes: Record<string, Quote>,
  t: T,
  opts: { userId: string | null; liveLinks?: LiveLinks | null },
) {
  const rows = buildRows(items, quotes)
  const [{ default: ExcelJS }, { addCharts, sheetRef, excelDate }, growth] = await Promise.all([
    import('exceljs'),
    import('@/lib/xlsxCharts'),
    loadGrowth(rows, opts.userId),
  ])
  type ChartSpec = import('@/lib/xlsxCharts').ChartSpec

  const wb = new ExcelJS.Workbook()
  wb.creator = 'ORBIT'
  wb.created = new Date()

  const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF111111' } }
  const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }
  const GREEN = 'FF16A34A'
  const RED = 'FFDC2626'
  const MUTED = 'FF888888'
  const MONEY = '#,##0.00'
  const PCT = '0.00%'
  const totals = totalsByCurrency(rows)
  const currencies = Object.keys(totals).sort()

  // Sheet names are referenced by chart formulas; Excel caps them at 31 chars
  const sheetName = (key: string) => t(key).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
  const CHARTS = sheetName('exp_charts')
  const SUMMARY = sheetName('exp_summary')
  const GROWTH = sheetName('exp_growth')

  // Sheet 1 — charts (filled at the end, it is the sheet the file opens on)
  const cs = wb.addWorksheet(CHARTS, { views: [{ showGridLines: false }] })

  // Sheet 2 — positions
  const ws = wb.addWorksheet(sheetName('exp_positions'), { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.addRow(positionHeaders(t))
  rows.forEach(r => ws.addRow(rowValues(r)))
  ws.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
  const widths = [12, 30, 10, 15, 9, 8, 11, 12, 12, 11, 14, 14, 13, 9, 9]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ;[8, 9, 11, 12, 13].forEach(c => { ws.getColumn(c).numFmt = MONEY })
  ;[10, 14, 15].forEach(c => { ws.getColumn(c).numFmt = PCT })
  ws.getColumn(7).numFmt = '#,##0.####'
  rows.forEach((r, i) => {
    const row = ws.getRow(i + 2)
    ;[13, 14].forEach(c => { row.getCell(c).font = { color: { argb: r.pnl >= 0 ? GREEN : RED } } })
    if (r.dayChangePct != null) row.getCell(10).font = { color: { argb: r.dayChangePct >= 0 ? GREEN : RED } }
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } }

  // Sheet 3 — summary, totals per currency and allocation by type
  const sum = wb.addWorksheet(SUMMARY)
  sum.addRow([t('exp_exportedAt'), new Date()]).getCell(2).numFmt = 'dd/mm/yyyy hh:mm'
  sum.addRow([])
  sum.addRow([t('exp_byCurrency')]).font = { bold: true, size: 13 }
  const hdr1 = sum.addRow([t('exp_currency'), t('exp_count'), t('value'), t('exp_invested'), t('pnl'), `${t('pnl')} %`])
  hdr1.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
  currencies.forEach(cur => {
    const v = totals[cur]
    const pnl = v.value - v.cost
    const row = sum.addRow([cur, v.count, v.value, v.cost, pnl, v.cost ? pnl / v.cost : 0])
    ;[3, 4, 5].forEach(c => { row.getCell(c).numFmt = MONEY })
    row.getCell(6).numFmt = PCT
    ;[5, 6].forEach(c => { row.getCell(c).font = { color: { argb: pnl >= 0 ? GREEN : RED } } })
  })
  sum.addRow([])
  sum.addRow([t('exp_byType')]).font = { bold: true, size: 13 }
  const hdr2 = sum.addRow([t('exp_type'), t('exp_currency'), t('exp_count'), t('value'), t('exp_weight')])
  hdr2.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
  const byType = new Map<string, { type: string; currency: string; count: number; value: number; weight: number }>()
  rows.forEach(r => {
    const key = `${r.type}|${r.currency}`
    const e = byType.get(key) ?? { type: r.type, currency: r.currency, count: 0, value: 0, weight: 0 }
    e.count++
    e.value += r.value
    e.weight += r.weight
    byType.set(key, e)
  })
  // Contiguous rows per currency: each block feeds one allocation pie
  const allocBlocks: Record<string, { from: number; to: number; labels: string[]; values: number[] }> = {}
  ;[...byType.values()]
    .sort((a, b) => a.currency.localeCompare(b.currency) || b.value - a.value)
    .forEach(e => {
      const row = sum.addRow([e.type || '—', e.currency, e.count, e.value, e.weight])
      row.getCell(4).numFmt = MONEY
      row.getCell(5).numFmt = PCT
      const b = (allocBlocks[e.currency] ??= { from: row.number, to: row.number, labels: [], values: [] })
      b.to = row.number
      b.labels.push(e.type || '—')
      b.values.push(e.value)
    })
  if (opts.liveLinks) {
    sum.addRow([])
    sum.addRow([t('exp_liveLinks')]).font = { bold: true, size: 13 }
    ;([['live_positions', opts.liveLinks.positions], ['live_history', opts.liveLinks.history]] as const).forEach(([key, url]) => {
      const row = sum.addRow([t(key), { text: url, hyperlink: url }])
      row.getCell(2).font = { color: { argb: 'FF2563EB' }, underline: true }
    })
    sum.addRow([t('live_excelHint')]).getCell(1).font = { italic: true, color: { argb: MUTED } }
  }
  ;[22, 10, 12, 16, 16, 10].forEach((w, i) => { sum.getColumn(i + 1).width = w })

  // Sheet 4 — growth: value vs invested capital over time, per currency
  const gs = wb.addWorksheet(GROWTH, { views: [{ state: 'frozen', ySplit: 1 }] })
  const gh = gs.addRow([t('exp_date'), t('exp_currency'), t('value'), t('exp_invested'), t('pnl'), `${t('pnl')} %`, t('exp_source')])
  gh.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT })
  const growthBlocks: Record<string, { from: number; to: number; points: GrowthPoint[] }> = {}
  growth.forEach(p => {
    const r = gs.rowCount + 1
    const pnl = p.cost == null ? null : p.value - p.cost
    const row = gs.addRow([
      new Date(`${p.date}T00:00:00Z`), p.currency, p.value, p.cost,
      pnl == null ? null : { formula: `C${r}-D${r}`, result: pnl },
      pnl == null || !p.cost ? null : { formula: `IF(D${r}=0,"",E${r}/D${r})`, result: pnl / p.cost },
      t(p.source === 'real' ? 'exp_real' : 'exp_estimated'),
    ])
    row.getCell(1).numFmt = 'dd/mm/yyyy'
    ;[3, 4, 5].forEach(c => { row.getCell(c).numFmt = MONEY })
    row.getCell(6).numFmt = PCT
    if (pnl != null) [5, 6].forEach(c => { row.getCell(c).font = { color: { argb: pnl >= 0 ? GREEN : RED } } })
    if (p.source === 'estimated') row.getCell(7).font = { italic: true, color: { argb: MUTED } }
    const b = (growthBlocks[p.currency] ??= { from: r, to: r, points: [] })
    b.to = r
    b.points.push(p)
  })
  ;[14, 10, 16, 16, 14, 10, 14].forEach((w, i) => { gs.getColumn(i + 1).width = w })
  gs.getCell('I1').value = t('exp_estimatedNote')
  gs.getCell('I1').font = { italic: true, color: { argb: MUTED } }

  // Charts sheet: per currency a KPI line, then growth line + allocation pie side by side
  cs.getCell('A1').value = `ORBIT — ${t('exp_growth')}`
  cs.getCell('A1').font = { bold: true, size: 16 }
  cs.getCell('A2').value = new Date()
  cs.getCell('A2').numFmt = 'dd/mm/yyyy hh:mm'
  cs.getCell('A2').font = { color: { argb: MUTED } }
  cs.getColumn(1).width = 12

  const BLOCK = 24
  const charts: ChartSpec[] = []
  currencies.forEach((cur, k) => {
    const top = 3 + k * BLOCK // zero-based row of the KPI line
    const v = totals[cur]
    const pnl = v.value - v.cost
    const kpi = cs.getRow(top + 1)
    kpi.values = [cur, t('value'), v.value, t('exp_invested'), v.cost, t('pnl'), pnl, v.cost ? pnl / v.cost : 0]
    kpi.font = { bold: true }
    ;[3, 5, 7].forEach(c => { kpi.getCell(c).numFmt = MONEY })
    kpi.getCell(8).numFmt = PCT
    ;[7, 8].forEach(c => { kpi.getCell(c).font = { bold: true, color: { argb: pnl >= 0 ? GREEN : RED } } })

    const g = growthBlocks[cur]
    if (g && g.points.length > 1) {
      charts.push({
        type: 'line',
        title: t('exp_growthChart').replace('{cur}', cur),
        catRef: sheetRef(GROWTH, 'A', g.from, g.to),
        cats: g.points.map(p => excelDate(p.date)),
        series: [
          { name: t('value'), ref: sheetRef(GROWTH, 'C', g.from, g.to), values: g.points.map(p => p.value), color: '22C55E' },
          { name: t('exp_invested'), ref: sheetRef(GROWTH, 'D', g.from, g.to), values: g.points.map(p => p.cost), color: '64748B' },
        ],
        from: { col: 0, row: top + 2 },
        to: { col: 9, row: top + BLOCK - 1 },
      })
    }
    const a = allocBlocks[cur]
    if (a) {
      charts.push({
        type: 'pie',
        title: t('exp_allocChart').replace('{cur}', cur),
        catRef: sheetRef(SUMMARY, 'A', a.from, a.to),
        cats: a.labels,
        series: [{ name: t('value'), ref: sheetRef(SUMMARY, 'D', a.from, a.to), values: a.values }],
        from: { col: 10, row: top + 2 },
        to: { col: 16, row: top + BLOCK - 1 },
      })
    }
  })

  const buf = await wb.xlsx.writeBuffer()
  const withCharts = await addCharts(buf as ArrayBuffer, CHARTS, charts)
  download(new Blob([withCharts], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName('xlsx'))
}

// ── Google Sheets ─────────────────────────────────────────────────────────────
// Sheets parses pasted numbers with the account's locale, so format them the way the browser locale expects.

export async function copyForGoogleSheets(items: PortfolioItem[], quotes: Record<string, Quote>, t: T) {
  const dec = new Intl.NumberFormat().formatToParts(1.5).find(p => p.type === 'decimal')?.value ?? '.'
  const num = (n: number | null, digits = 2) => (n == null ? '' : n.toFixed(digits).replace('.', dec))
  const pct = (n: number | null) => (n == null ? '' : `${num(n * 100)}%`)
  const clean = (s: string) => s.replace(/[\t\n\r]/g, ' ')

  const lines = [positionHeaders(t).join('\t')]
  buildRows(items, quotes).forEach(r => {
    lines.push([
      r.symbol, clean(r.name), r.type, r.isin, r.position, r.currency, num(r.quantity, 4),
      num(r.avgPrice), num(r.price), pct(r.dayChangePct), num(r.value), num(r.cost), num(r.pnl), pct(r.pnlPct), pct(r.weight),
    ].join('\t'))
  })
  await navigator.clipboard.writeText(lines.join('\n'))
}

// ── CSV ───────────────────────────────────────────────────────────────────────
// RFC 4180: comma separator, dot decimals, quoted strings. BOM so Excel reads UTF-8 accents.

export function exportCsv(items: PortfolioItem[], quotes: Record<string, Quote>, t: T) {
  const cell = (v: string | number | null) => {
    if (v == null) return ''
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6)
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  const lines = [positionHeaders(t).map(cell).join(',')]
  buildRows(items, quotes).forEach(r => lines.push(rowValues(r).map(cell).join(',')))
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName('csv'))
}

// ── Live links ────────────────────────────────────────────────────────────────
// A secret token per user; /api/feed/<token>/… serves CSV that Sheets/Excel re-fetch on their own.

export interface LiveLinks { token: string; positions: string; history: string }

export function liveLinks(token: string, lang: string): LiveLinks {
  const base = `${window.location.origin}/api/feed/${token}`
  return { token, positions: `${base}/positions.csv?lang=${lang}`, history: `${base}/history.csv?lang=${lang}` }
}

// null = no link yet; throws when the table is missing (migration not run)
export async function getLiveToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('export_tokens').select('token').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.token ?? null
}

export async function createLiveToken(userId: string): Promise<string> {
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
  const { error } = await supabase
    .from('export_tokens')
    .upsert({ user_id: userId, token, created_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
  return token
}

export async function revokeLiveToken(userId: string) {
  const { error } = await supabase.from('export_tokens').delete().eq('user_id', userId)
  if (error) throw error
}
