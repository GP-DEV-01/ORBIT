// Native Excel charts for an .xlsx produced by exceljs (which cannot write charts).
// Post-processes the zip: adds DrawingML chart parts, a drawing anchored on one sheet,
// and the relationships / content types that tie them together.
// Charts reference cell ranges, so they stay live if the user edits the data in Excel;
// the cached values let viewers that don't recalculate (Quick Look, previews) render them too.

import JSZip from 'jszip'

export interface ChartSeries {
  name: string
  ref: string                    // e.g. 'Growth'!$C$2:$C$40
  values: (number | null)[]
  color?: string                 // RRGGBB, line charts
}

export interface ChartSpec {
  type: 'line' | 'pie'
  title: string
  catRef: string
  cats: (string | number)[]      // line: Excel date serials, pie: labels
  series: ChartSeries[]
  from: { col: number; row: number }  // zero-based anchor cells
  to: { col: number; row: number }
}

export const PIE_COLORS = ['22C55E', '3B82F6', 'F59E0B', 'A855F7', 'EF4444', '14B8A6', 'EC4899', '84CC16', '64748B']

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function sheetRef(sheet: string, col: string, r1: number, r2: number) {
  return `'${sheet.replace(/'/g, "''")}'!$${col}$${r1}:$${col}$${r2}`
}

export function excelDate(isoDate: string) {
  return Date.parse(`${isoDate}T00:00:00Z`) / 86400000 + 25569
}

function numCache(values: (number | string | null)[], format: string) {
  const pts = values
    .map((v, i) => (v == null || v === '' ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`))
    .join('')
  return `<c:numCache><c:formatCode>${esc(format)}</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`
}

function strCache(values: (string | number)[]) {
  const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(String(v))}</c:v></c:pt>`).join('')
  return `<c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache>`
}

function title(text: string) {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr>`
    + `<a:r><a:rPr lang="en-US" sz="1200" b="1"/><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx>`
    + `<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
}

function lineChart(spec: ChartSpec) {
  const series = spec.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>`
    + `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>`
    + `<c:spPr><a:ln w="${i === 0 ? 28575 : 19050}" cap="rnd"><a:solidFill><a:srgbClr val="${s.color ?? '22C55E'}"/></a:solidFill>`
    + `${i === 0 ? '' : '<a:prstDash val="dash"/>'}<a:round/></a:ln></c:spPr>`
    + `<c:marker><c:symbol val="none"/></c:marker>`
    + `<c:cat><c:numRef><c:f>${esc(spec.catRef)}</c:f>${numCache(spec.cats, 'dd/mm/yyyy')}</c:numRef></c:cat>`
    + `<c:val><c:numRef><c:f>${esc(s.ref)}</c:f>${numCache(s.values, '#,##0.00')}</c:numRef></c:val>`
    + `<c:smooth val="0"/></c:ser>`).join('')
  const gridline = `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E5E5E5"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>`
  return `<c:plotArea><c:layout/>`
    + `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}`
    + `<c:marker val="1"/><c:axId val="500001"/><c:axId val="500002"/></c:lineChart>`
    + `<c:dateAx><c:axId val="500001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>`
    + `<c:axPos val="b"/><c:numFmt formatCode="mmm yy" sourceLinked="0"/><c:majorTickMark val="out"/>`
    + `<c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="500002"/><c:crosses val="autoZero"/>`
    + `<c:auto val="1"/><c:lblOffset val="100"/><c:baseTimeUnit val="days"/></c:dateAx>`
    + `<c:valAx><c:axId val="500002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>`
    + `<c:axPos val="l"/>${gridline}<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="out"/>`
    + `<c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="500001"/><c:crosses val="autoZero"/>`
    + `<c:crossBetween val="between"/></c:valAx></c:plotArea>`
}

function pieChart(spec: ChartSpec) {
  const s = spec.series[0]
  const points = spec.cats.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/>`
    + `<c:spPr><a:solidFill><a:srgbClr val="${PIE_COLORS[i % PIE_COLORS.length]}"/></a:solidFill>`
    + `<a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('')
  const labels = `<c:dLbls><c:numFmt formatCode="0.0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>`
    + `<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/>`
    + `<c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>`
  return `<c:plotArea><c:layout/><c:pieChart><c:varyColors val="1"/>`
    + `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${points}${labels}`
    + `<c:cat><c:strRef><c:f>${esc(spec.catRef)}</c:f>${strCache(spec.cats)}</c:strRef></c:cat>`
    + `<c:val><c:numRef><c:f>${esc(s.ref)}</c:f>${numCache(s.values, '#,##0.00')}</c:numRef></c:val></c:ser>`
    + `<c:firstSliceAng val="0"/></c:pieChart></c:plotArea>`
}

function chartXml(spec: ChartSpec) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/>`
    + `<c:chart>${title(spec.title)}${spec.type === 'line' ? lineChart(spec) : pieChart(spec)}`
    + `<c:legend><c:legendPos val="${spec.type === 'line' ? 'b' : 'r'}"/><c:overlay val="0"/></c:legend>`
    + `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
}

function anchor(spec: ChartSpec, i: number) {
  const cell = (tag: string, p: { col: number; row: number }) =>
    `<xdr:${tag}><xdr:col>${p.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:${tag}>`
  return `<xdr:twoCellAnchor editAs="oneCell">${cell('from', spec.from)}${cell('to', spec.to)}`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
    + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
    + `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic>`
    + `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
}

function nextFree(zip: JSZip, pattern: (n: number) => string) {
  let n = 1
  while (zip.file(pattern(n))) n++
  return n
}

// Adds `charts` to the sheet named `sheetName`. The sheet must not already have a drawing.
export async function addCharts(buffer: ArrayBuffer, sheetName: string, charts: ChartSpec[]): Promise<ArrayBuffer> {
  if (!charts.length) return buffer
  const zip = await JSZip.loadAsync(buffer)

  // Resolve the sheet's part through workbook.xml → workbook.xml.rels
  const workbook = await zip.file('xl/workbook.xml')!.async('string')
  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map(m => m[0]).find(tag => tag.includes(`name="${esc(sheetName)}"`))
  const rid = sheetTag?.match(/r:id="([^"]+)"/)?.[1]
  const wbRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')
  const target = [...wbRels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0])
    .find(tag => tag.includes(`Id="${rid}"`))?.match(/Target="([^"]+)"/)?.[1]
  if (!target) throw new Error(`Sheet not found: ${sheetName}`)
  const sheetPath = `xl/${target.replace(/^\/?xl\//, '')}`
  const sheetFile = sheetPath.split('/').pop()!
  const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`

  const types: string[] = []

  // Chart parts
  const firstChart = nextFree(zip, n => `xl/charts/chart${n}.xml`)
  const chartRels = charts.map((spec, i) => {
    const n = firstChart + i
    zip.file(`xl/charts/chart${n}.xml`, chartXml(spec))
    types.push(`<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`)
    return `<Relationship Id="rId${i + 1}" Type="${REL}/chart" Target="../charts/chart${n}.xml"/>`
  })

  // Drawing part holding the anchors
  const d = nextFree(zip, n => `xl/drawings/drawing${n}.xml`)
  zip.file(`xl/drawings/drawing${d}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}">`
    + charts.map(anchor).join('') + `</xdr:wsDr>`)
  zip.file(`xl/drawings/_rels/drawing${d}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${chartRels.join('')}</Relationships>`)
  types.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)

  // Sheet → drawing relationship
  const drawingRid = 'rIdOrbitDrawing1'
  const drawingRel = `<Relationship Id="${drawingRid}" Type="${REL}/drawing" Target="../drawings/drawing${d}.xml"/>`
  const existingRels = await zip.file(sheetRelsPath)?.async('string')
  zip.file(sheetRelsPath, existingRels
    ? existingRels.replace('</Relationships>', `${drawingRel}</Relationships>`)
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel}</Relationships>`)

  // <drawing> must come before legacyDrawing / tableParts / extLst in the sheet XML
  let sheet = await zip.file(sheetPath)!.async('string')
  if (!/<worksheet\b[^>]*xmlns:r=/.test(sheet)) sheet = sheet.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `)
  const tag = `<drawing r:id="${drawingRid}"/>`
  const before = sheet.search(/<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/)
  sheet = before >= 0 ? sheet.slice(0, before) + tag + sheet.slice(before) : sheet.replace('</worksheet>', `${tag}</worksheet>`)
  zip.file(sheetPath, sheet)

  const ct = await zip.file('[Content_Types].xml')!.async('string')
  zip.file('[Content_Types].xml', ct.replace('</Types>', `${types.join('')}</Types>`))

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
