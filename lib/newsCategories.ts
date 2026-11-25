// Keyword classifier: assigns each article an economic category.
// Multilingual (IT/EN/DE/FR/ES). '*' at the end matches as a prefix ("inflazion*"), at the start as a
// suffix ("*krieg" → "Handelskrieg") — needed for German compound nouns.
// Order matters on ties: earlier categories win (central banks before banking, etc.).

export type NewsCategory =
  | 'centralBanks' | 'macro' | 'markets' | 'companies' | 'mergers'
  | 'energy' | 'crypto' | 'tech' | 'policy' | 'realEstate' | 'banking' | 'labor' | 'geopolitics' | 'other'

export const NEWS_CATEGORIES: NewsCategory[] = [
  'markets', 'macro', 'centralBanks', 'companies', 'mergers', 'policy', 'labor',
  'energy', 'banking', 'tech', 'crypto', 'realEstate', 'geopolitics', 'other',
]

const KEYWORDS: [NewsCategory, string[]][] = [
  ['centralBanks', [
    'bce', 'ecb', 'fed', 'federal reserve', 'powell', 'lagarde', 'bank of england', 'boe', 'bank of japan', 'boj',
    'banca centrale', 'banche centrali', 'central bank*', 'tassi', 'tasso di interesse', 'taglio dei tassi', 'rate cut*', 'rate hike*',
    'interest rate*', 'monetary policy', 'politica monetaria', 'bundesbank', 'leitzins*', 'zinsen', 'zinssenkung*', 'notenbank*',
    'banque centrale', 'taux directeur*', "taux d'intérêt", 'banco central', 'tipos de interés', 'tipos de interes', 'fomc',
  ]],
  ['mergers', [
    'acquisizion*', 'fusion*', 'opa', 'ipo', 'quotazion*', 'merger*', 'acquisition*', 'acquire*', 'takeover*', 'buyout*',
    'übernahme*', 'börsengang', 'rachat', 'rachète', 'introduction en bourse', 'adquisición', 'adquisicion', 'fusión', 'salida a bolsa',
    'deal', 'scalata', 'offerta pubblica',
  ]],
  ['crypto', [
    'bitcoin', 'btc', 'ethereum', 'crypto*', 'cripto*', 'blockchain', 'stablecoin*', 'krypto*', 'binance', 'coinbase', 'token*',
  ]],
  ['energy', [
    'petrolio', 'greggio', 'oil', 'crude', 'brent', 'wti', 'opec*', 'gas', 'gnl', 'lng', 'energia', 'energy', 'energetic*',
    'oro', 'gold', 'rame', 'copper', 'materie prime', 'commodit*', 'öl', 'ölpreis*', 'energie*', 'strompreis*', 'pétrole',
    'énergie', 'petróleo', 'energía', 'electricity', 'elettricità', 'rinnovabil*', 'renewable*',
    'nuclear*', 'nuclea*', 'nucléaire', 'atom*', 'akw', 'kernkraft*', '*kraftwerk*', 'windkraft*', 'éolien*', 'eolic*',
    'carburant*', 'benzina', 'diesel', 'fuel*', '*sprit*', 'raffin*', 'refiner*', 'epr', 'edf', 'eni', 'enel',
  ]],
  ['macro', [
    'pil', 'gdp', 'inflazion*', 'inflation*', 'istat', 'eurostat', 'disoccupazion*', 'occupazion*', 'unemployment', 'jobs report',
    'payroll*', 'pmi', 'crescita economica', 'economic growth', 'recession*', 'recessione', 'konjunktur*', 'bip', 'arbeitslos*',
    'croissance', 'chômage', 'insee', 'pib', 'paro', 'empleo', 'ipc', 'cpi', 'consumer prices', 'prezzi al consumo', 'retail sales',
    'vendite al dettaglio', 'fiducia', 'consumer confidence', 'ifo', 'zew', 'produzione industriale', 'industrial production',
    'debito pubblico', 'public debt', 'spread', 'deficit',
  ]],
  ['policy', [
    'dazi', 'dazio', 'tariff*', 'trade war', 'guerra commerciale', 'sanzion*', 'sanction*', 'manovra', 'legge di bilancio',
    'fisco', 'fiscal*', 'tasse', 'tassa', 'tax*', 'budget', 'governo', 'government', 'zoll', 'zölle', 'steuer*', 'haushalt',
    'droits de douane', 'impôt*', 'aranceles', 'impuesto*', 'presupuesto*', 'pnrr', 'commissione europea', 'european commission',
    'bruxelles', 'brussels', 'regulat*', 'antitrust', 'handelskonflikt*', 'handelskrieg*', 'guerre commerciale',
    'decreto', 'ddl', 'ministr*', 'ocse', 'oecd', 'ocde', 'regierung*', 'gouvernement', 'gobierno',
  ]],
  ['companies', [
    'trimestral*', 'utile', 'utili', 'ricavi', 'fatturato', 'earnings', 'revenue*', 'profit*', 'quarterly', 'guidance',
    'dividend*', 'ceo', 'amministratore delegato', 'bilancio', 'semestrale', 'gewinn*', 'umsatz', 'quartal*', 'bénéfice*',
    "chiffre d'affaires", 'résultats', 'beneficio*', 'ingresos', 'resultados', 'layoff*', 'licenziament*', 'stellenabbau',
    'results', 'sales', 'vendite', 'gruppo', 'azienda', 'aziende', 'impresa', 'imprese', 'investiment*', 'commess*',
    'stabiliment*', 'company', 'companies', 'konzern*', 'unternehmen*', 'aufsichtsrat*', 'vorstand*', 'entreprise*',
    'groupe', 'usine*', 'contrat', 'commande', 'empresa*', 'compañía*', 'grupo', 'industria*', 'industrie*', 'industrial*',
    'export*', 'fabbrica', 'factory', 'fabrik*', 'business',
  ]],
  ['labor', [
    'lavoro', 'lavorator*', 'salari*', 'stipend*', 'busta paga', 'sindacat*', 'inps', 'bonus', 'assunzion*', 'assume',
    'sciopero', 'scioperi', 'pensioni', 'pension*', 'welfare', 'wage*', 'salary', 'salaries', 'workers', 'union*',
    'strike*', 'hiring', 'lohn*', 'löhne', 'tarif*', 'gewerkschaft*', 'ig metall', 'streik*', 'beschäftigt*', 'rente*',
    'salaire*', 'salarié*', 'salarisés', 'syndicat*', 'grève*', 'emploi', 'retraite*', 'salario*', 'sueldo*',
    'sindicato*', 'huelga*', 'trabajador*', 'pensiones', 'formazione', 'formation',
  ]],
  ['banking', [
    'banca', 'banche', 'bank', 'banks', 'banking', 'bancari*', 'assicura*', 'insurer*', 'insurance', 'credito', 'credit',
    'unicredit', 'intesa', 'mps', 'banken', 'versicherung*', 'banque*', 'banco', 'bancos', 'jpmorgan', 'goldman',
  ]],
  ['tech', [
    'intelligenza artificiale', 'artificial intelligence', 'ai', 'ia', 'ki', 'chip*', 'semiconductor*', 'semiconduttor*',
    'nvidia', 'apple', 'microsoft', 'alphabet', 'google', 'amazon', 'meta platforms', 'tesla', 'openai', 'anthropic', 'software',
    'tech', 'tecnologi*', 'technolog*', 'startup*', 'data center*', 'künstliche intelligenz', 'halbleiter*',
    'fibra', 'telecom*', 'satellit*', 'spazio', 'space', 'raumfahrt*', 'spatial*', 'digital*', 'cloud', 'cyber*',
  ]],
  ['realEstate', [
    'immobiliar*', 'mutui', 'mutuo', 'mortgage*', 'housing', 'real estate', 'house prices', 'immobilien*', 'immobilier',
    'vivienda*', 'hipoteca*', 'affitti', 'rental*', 'mieten',
  ]],
  ['markets', [
    'borsa', 'borse', 'piazza affari', 'ftse', 'mib', 'dax', 'cac', 'ibex', 's&p', 'nasdaq', 'dow jones', 'wall street',
    'stocks', 'shares', 'equities', 'azion*', 'titoli', 'btp', 'bund', 'bond*', 'obbligazion*', 'rendiment*', 'yield*',
    'treasur*', 'bourse', 'aktie*', 'börse*', 'anleihe*', 'obligation*', 'bolsa', 'acciones', 'mercati', 'markets', 'stock market',
    'forex', 'tasso di cambio', 'exchange rate', 'yen', 'sterlina', 'sterling', 'devisen', 'rally', 'sell-off', 'selloff',
    'listino', 'indici', 'futures', 'investitori', 'investors', 'anleger', 'marchés', 'valeurs', 'mercados',
  ]],
  ['geopolitics', [
    'guerra', 'guerre', 'war', 'krieg*', '*krieg', 'ucraina', 'ukraine', 'ucrania', 'iran', 'israel*', 'gaza', 'russia',
    'russland', 'russie', 'rusia', 'cina', 'china', 'chine', 'trump', 'putin', 'xi jinping', 'g7', 'g20', 'nato', 'onu',
    'elezioni', 'election*', 'wahl*', 'élection*', 'elecciones', 'diplomazia', 'diplomatie', 'diplomacy', 'geopolitic*',
    'geopolitik', 'géopolitique',
  ]],
]

// Unicode-aware word boundaries: \b doesn't handle accented letters
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const COMPILED: [NewsCategory, RegExp][] = KEYWORDS.map(([cat, words]) => {
  const parts = words.map(w => {
    const core = escape(w.replace(/^\*|\*$/g, ''))
    return `${w.startsWith('*') ? '[\\p{L}\\p{N}]*' : ''}${core}${w.endsWith('*') ? '[\\p{L}\\p{N}]*' : ''}`
  })
  return [cat, new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})(?![\\p{L}\\p{N}])`, 'giu')]
})

// Specific signals ("opa", "ipo") must beat incidental ones (the bank names inside an M&A story)
const WEIGHT: Partial<Record<NewsCategory, number>> = { mergers: 2 }

export function classifyNews(title: string, summary = ''): NewsCategory {
  let best: NewsCategory = 'other'
  let bestScore = 0
  for (const [cat, re] of COMPILED) {
    // Headline matches weigh more than summary matches
    const score = ((title.match(re)?.length ?? 0) * 3 + (summary.match(re)?.length ?? 0)) * (WEIGHT[cat] ?? 1)
    if (score > bestScore) {
      best = cat
      bestScore = score
    }
  }
  return best
}
