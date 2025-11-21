// server.js — robust, path-regexp-safe RSS aggregator backend
require('dotenv').config();
const express = require('express');
const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new RSSParser();
const app = express();
const PORT = process.env.PORT || 2000;

const frontendPath = path.resolve(__dirname, '../frontend');
console.log('DEBUG frontendPath =', frontendPath);
console.log('DEBUG frontend exists =', fs.existsSync(frontendPath));

app.use(express.json());
app.use(require('cors')());

// Serve static files if frontend exists (this is safe)
if (fs.existsSync(frontendPath) && fs.lstatSync(frontendPath).isDirectory()) {
  app.use(express.static(frontendPath));
} else {
  console.warn('WARNING: frontend folder not found — static files will not be served.');
}

// --- RSS AGGREGATOR CONFIG ---
const FEEDS = [
  'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en',
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.theguardian.com/world/rss',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',         // Wall Street Journal (headlines)
];

let cachedArticles = [];
let lastUpdated = null;
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS) || 60_000;

function normalizeItem(item, sourceName) {
  return {
    id: item.id || item.guid || item.link || (item.title + '|' + (item.pubDate||'')),
    title: item.title || '',
    description: item.contentSnippet || item.content || item.description || '',
    url: item.link || '',
    source: sourceName || (item.source && item.source.title) || '',
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    image: (item.enclosure && item.enclosure.url) || null
  };
}

async function fetchAllFeedsOnce() {
  try {
    const results = [];
    for (const feedUrl of FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const sourceName = feed.title || feedUrl;
        for (const item of feed.items || []) {
          results.push(normalizeItem(item, sourceName));
        }
      } catch (e) {
        console.warn('Failed to fetch feed:', feedUrl, e && e.message);
      }
    }

    // dedupe by link/url
    const map = new Map();
    for (const a of results) {
      if (!a.url) continue;
      const key = a.url.split('#')[0];
      const existing = map.get(key);
      if (!existing) map.set(key, a);
      else if (new Date(a.publishedAt) > new Date(existing.publishedAt)) map.set(key, a);
    }

    const arr = Array.from(map.values()).sort((x, y) => new Date(y.publishedAt) - new Date(x.publishedAt));
    cachedArticles = arr;
    lastUpdated = new Date();
    console.log(`Feeds polled: articles=${cachedArticles.length} at ${lastUpdated.toISOString()}`);
  } catch (err) {
    console.error('Error in fetchAllFeedsOnce()', err && err.stack ? err.stack : err);
  }
}

// start polling
fetchAllFeedsOnce();
setInterval(fetchAllFeedsOnce, POLL_INTERVAL);

// Simple ping
app.get('/api/ping', (req, res) => res.json({ ok: true, msg: 'pong' }));

// API endpoint (no complex route patterns)
app.get('/api/news', (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const max = Math.min(200, Math.max(1, Number(req.query.max) || 20));
    const source = (req.query.source || '').trim().toLowerCase();

    let list = cachedArticles.slice();

    if (q) {
      list = list.filter(a => (a.title + ' ' + a.description + ' ' + (a.source||'')).toLowerCase().includes(q));
    }
    if (source) list = list.filter(a => (a.source || '').toLowerCase().includes(source));

    res.json({ total: list.length, lastUpdated, articles: list.slice(0, max) });
  } catch (err) {
    console.error('Error /api/news', err);
    res.status(500).json({ error: 'failed' });
  }
});

// VERY SAFE fallback: use app.use middleware, do not use wildcard route patterns
app.use((req, res, next) => {
  // skip API paths
  if (req.path.startsWith('/api')) return next();

  // only serve index for GET
  if (req.method !== 'GET') return next();

  const indexFile = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  return res.status(404).send('Index file not found (server).');
});

// global error handler to print stack
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).send('Server error');
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});