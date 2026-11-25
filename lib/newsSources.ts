// Economic news sources by country. Feeds verified working (Sept 2026).
// Excluded: Milano Finanza (404), Teleborsa (malformed XML), Les Echos / El Economista (403),
// Corriere Economia (feed stale since 2023). Reuters no longer publishes RSS.

export type NewsCountry = 'IT' | 'US' | 'UK' | 'DE' | 'FR' | 'ES' | 'EU' | 'GLOBAL'

export interface NewsSource {
  name: string
  url: string
  country: NewsCountry
}

export const NEWS_COUNTRIES: { code: NewsCountry; flag: string }[] = [
  { code: 'IT', flag: '🇮🇹' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'UK', flag: '🇬🇧' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'ES', flag: '🇪🇸' },
  { code: 'EU', flag: '🇪🇺' },
  { code: 'GLOBAL', flag: '🌐' },
]

// GLOBAL comes from Finnhub (see app/api/news/route.ts), not RSS
export const RSS_SOURCES: NewsSource[] = [
  { country: 'IT', name: 'Il Sole 24 Ore', url: 'https://www.ilsole24ore.com/rss/economia.xml' },
  { country: 'IT', name: 'Il Sole 24 Ore', url: 'https://www.ilsole24ore.com/rss/finanza.xml' },
  { country: 'IT', name: 'ANSA Economia', url: 'https://www.ansa.it/sito/notizie/economia/economia_rss.xml' },
  { country: 'IT', name: 'Repubblica Economia', url: 'https://www.repubblica.it/rss/economia/rss2.0.xml' },
  { country: 'IT', name: 'Money.it', url: 'https://www.money.it/spip.php?page=backend' },

  { country: 'US', name: 'Wall Street Journal', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
  { country: 'US', name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { country: 'US', name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { country: 'US', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { country: 'US', name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { country: 'US', name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },

  { country: 'UK', name: 'Financial Times', url: 'https://www.ft.com/markets?format=rss' },
  { country: 'UK', name: 'Financial Times', url: 'https://www.ft.com/rss/home' },
  { country: 'UK', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { country: 'UK', name: 'The Guardian', url: 'https://www.theguardian.com/uk/business/rss' },
  { country: 'UK', name: 'The Economist', url: 'https://www.economist.com/finance-and-economics/rss.xml' },

  { country: 'DE', name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/finanzen' },
  { country: 'DE', name: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen' },
  { country: 'DE', name: 'FAZ', url: 'https://www.faz.net/rss/aktuell/wirtschaft/' },
  { country: 'DE', name: 'Der Spiegel', url: 'https://www.spiegel.de/wirtschaft/index.rss' },
  { country: 'DE', name: 'Tagesschau', url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml' },
  { country: 'DE', name: 'n-tv', url: 'https://www.n-tv.de/wirtschaft/rss' },

  { country: 'FR', name: 'Le Figaro', url: 'https://www.lefigaro.fr/rss/figaro_economie.xml' },
  { country: 'FR', name: 'Le Monde', url: 'https://www.lemonde.fr/economie/rss_full.xml' },
  { country: 'FR', name: 'BFM Business', url: 'https://www.bfmtv.com/rss/economie/' },
  { country: 'FR', name: 'La Tribune', url: 'https://www.latribune.fr/feed.xml' },

  { country: 'ES', name: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/mercados.xml' },
  { country: 'ES', name: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/portada.xml' },
  { country: 'ES', name: 'Cinco Días', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada' },
  { country: 'ES', name: 'El País Economía', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada' },

  { country: 'EU', name: 'BCE / ECB', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { country: 'EU', name: 'Euronews Business', url: 'https://www.euronews.com/rss?level=vertical&name=business' },
]
