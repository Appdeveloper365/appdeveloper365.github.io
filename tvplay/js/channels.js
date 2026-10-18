/**
 * channels.js
 * Default curated channels & playlists for TVPlay.
 *
 * LEGAL SOURCES ONLY: all entries come from iptv-org's public data with
 * their official blocklist applied (channels removed at the request of
 * rights-holders are excluded) and obvious pay-telemetry tiers filtered
 * out. The bundled sports playlist is curated from free-to-air and
 * free-ad-supported (FAST) sports channels worldwide.
 */

const DEFAULT_PLAYLISTS = [
  {
    name: 'Sports World (bundled)',      // 230+ free/FAST sports channels, worldwide
    url: 'assets/sports-world.m3u',
    group: 'Sports'
  },
  {
    name: 'iPTV-org Sports (live)',      // live refresh from the community index
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    group: 'Sports'
  },
  {
    name: 'iPTV-org News',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    group: 'News'
  },
  {
    name: 'iPTV-org Movies',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    group: 'Movies'
  },
  {
    name: 'iPTV-org Documentary',
    url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',
    group: 'Documentary'
  },
  {
    name: 'iPTV-org Music',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    group: 'Music'
  },
  {
    name: 'iPTV-org Kids',
    url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
    group: 'Kids'
  }
];

// Fallback direct streams — official, publicly published HLS feeds
// ( broadcasters publish these themselves for free internet viewing )
const DIRECT_CHANNELS = [
  {
    name: 'Al Jazeera English',
    url: 'https://live-hls-web-aje.getaj.net/AJE/03.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Al_Jazeera_English_logo.svg/1200px-Al_Jazeera_English_logo.svg.png',
    group: 'News',
    id: 'al-jazeera-english'
  },
  {
    name: 'Al Jazeera Arabic',
    url: 'https://live-hls-web-aja.getaj.net/AJA/03.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Al_Jazeera_English_logo.svg/1200px-Al_Jazeera_English_logo.svg.png',
    group: 'News',
    id: 'al-jazeera-arabic'
  },
  {
    name: 'DW English',
    url: 'https://dw-streamlive-live.akamaized.net/hls/live/2003594/dw-channel/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/DW_Logo.svg/1200px-DW_Logo.svg.png',
    group: 'News',
    id: 'dw-english'
  },
  {
    name: 'France 24 English',
    url: 'https://f24hls.akamaized.net/hls/live/2003629/f24_en/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/France_24_logo.svg/1200px-France_24_logo.svg.png',
    group: 'News',
    id: 'france-24'
  },
  {
    name: 'Euronews',
    url: 'https://euronews-hls.amagi.tv/hls/live/2005346/euronews/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Euronews_logo.svg/1200px-Euronews_logo.svg.png',
    group: 'News',
    id: 'euronews'
  },
  {
    name: 'Red Bull TV',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Red_Bull_TV_logo.svg/1200px-Red_Bull_TV_logo.svg.png',
    group: 'Sports',
    id: 'red-bull-tv'
  },
  {
    name: 'CBS Sports HQ',
    url: 'https://propee33f9c2.airspace-cdn.cbsivideo.com/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/CBS_Sports_HQ_logo.svg/1200px-CBS_Sports_HQ_logo.svg.png',
    group: 'Sports',
    id: 'cbs-sports-hq'
  },
  {
    name: 'CBS Sports Golazo Network',
    url: 'https://proped3fhg87.airspace-cdn.cbsivideo.com/golazo-live-dai/master/golazo-live-dai.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/CBS_Sports_HQ_logo.svg/1200px-CBS_Sports_HQ_logo.svg.png',
    group: 'Sports',
    id: 'cbs-sports-golazo'
  },
  {
    name: 'FIFA+',
    url: 'https://ba3e2e93.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9GSUZBUGx1c0VuZ2xpc2hfSExT/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png',
    group: 'Soccer ⚽ (Free)',
    id: 'fifa-plus'
  },
  {
    name: 'FIFA+ Women',
    url: 'https://cffda8ff.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9GSUZBUGx1c3dvbWVuX0hMUw/playlist.m3u8',
    logo: 'https://i.imgur.com/xy9ZxVO.png',
    group: 'Soccer ⚽ (Free)',
    id: 'fifa-plus-women'
  },
  {
    name: 'Sportitalia Solocalcio',
    url: 'https://distribution.sportitalialive.it/sportitalia/sisolocalcio_abr/playlist.m3u8',
    logo: 'https://i.imgur.com/hu56Ya5.png',
    group: 'Soccer ⚽ (Free)',
    id: 'sportitalia-solocalcio'
  },
  {
    name: 'beIN SPORTS XTRA',
    url: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Bein_Sports_XTRA_logo.svg/1200px-Bein_Sports_XTRA_logo.svg.png',
    group: 'Sports',
    id: 'bein-sports-xtra'
  },
  {
    name: 'beIN SPORTS XTRA en Español',
    url: 'https://aegis-cloudfront-1.tubi.video/01f6c149-449b-4248-8bda-2278799205ec/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Bein_Sports_XTRA_logo.svg/1200px-Bein_Sports_XTRA_logo.svg.png',
    group: 'Sports',
    id: 'bein-sports-xtra-es'
  }
];

window.DEFAULT_PLAYLISTS = DEFAULT_PLAYLISTS;
window.DIRECT_CHANNELS = DIRECT_CHANNELS;
