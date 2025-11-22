// script.js — improved frontend logic
const loadBtn = document.getElementById('load');
const qInput = document.getElementById('q');
const langSel = document.getElementById('lang');
const maxInput = document.getElementById('max');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const topResultsEl = document.getElementById('topResults');
const spinner = document.getElementById('spinner');
const darkToggle = document.getElementById('dark-toggle');
const catButtons = Array.from(document.querySelectorAll('.cat-btn'));

// Replace this with your Render URL (no trailing slash)
const API_BASE = 'https://fetchapi-new-app.onrender.com';

// Auto refresh (ms) - 10 minutes default
const AUTO_REFRESH_MS = 10 * 60 * 1000;
let autoRefreshTimer = null;

// small helper
function showSpinner(on = true) {
  spinner.classList.toggle('hidden', !on);
  spinner.setAttribute('aria-hidden', on ? 'false' : 'true');
}
function setStatus(txt) {
  statusEl.textContent = txt;
}

// basic fetch wrapper
async function fetchNews(paramsObj = {}) {
  const params = new URLSearchParams(paramsObj).toString();
  const url = `${API_BASE}/api/news?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

// render articles grid
function renderArticles(container, articles) {
  container.innerHTML = '';
  if (!articles || articles.length === 0) {
    container.innerHTML = '<div class="card">No articles found.</div>';
    return;
  }
  for (const a of articles) {
    const card = document.createElement('article');
    card.className = 'card';

    if (a.image) {
      const img = document.createElement('img');
      img.src = a.image;
      img.alt = a.title || 'news image';
      card.appendChild(img);
    }

    const title = document.createElement('div');
    title.className = 'title';
    const anchor = document.createElement('a');
    anchor.href = a.url || '#';
    anchor.textContent = a.title || 'Untitled';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    title.appendChild(anchor);

    const desc = document.createElement('p');
    desc.textContent = a.description || '';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${a.source || 'Unknown'} • ${a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ''}`;

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(meta);

    container.appendChild(card);
  }
}

// load main news from user inputs
async function loadNews() {
  const q = qInput.value.trim();
  const lang = langSel.value || 'en';
  const max = Math.min(50, Math.max(1, parseInt(maxInput.value, 10) || 10));

  setStatus('Loading...');
  showSpinner(true);
  resultsEl.innerHTML = '';

  try {
    const payload = await fetchNews({ q, lang, max });
    const articles = payload.articles || [];
    setStatus(`Showing ${articles.length} articles. Updated ${payload.fetchedAt ? new Date(payload.fetchedAt).toLocaleString() : ''}`);
    renderArticles(resultsEl, articles);
  } catch (err) {
    console.error(err);
    setStatus('Error loading news. See console.');
    resultsEl.innerHTML = `<div class="card">Error: ${err.message}</div>`;
  } finally {
    showSpinner(false);
  }
}

// load top headlines (separate smaller call - max 6)
async function loadTopHeadlines() {
  topResultsEl.textContent = 'Loading top headlines...';
  try {
    const payload = await fetchNews({ max: 6, q: '' });
    renderArticles(topResultsEl, payload.articles || []);
  } catch (err) {
    console.warn('Top headlines failed', err);
    topResultsEl.innerHTML = `<div class="card">Top headlines currently unavailable.</div>`;
  }
}

// categories quick-button handler
function onCategoryClick(cat) {
  qInput.value = ''; // clear search
  // request category through 'q' parameter so backend filters
  qInput.value = cat;
  maxInput.value = '10';
  loadNews();
  // visual active state
  catButtons.forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
}

// dark mode handling
function initDarkMode() {
  const saved = localStorage.getItem('dark') === '1';
  document.body.classList.toggle('dark', saved);
  darkToggle.checked = saved;
  darkToggle.addEventListener('change', () => {
    const enabled = darkToggle.checked;
    document.body.classList.toggle('dark', enabled);
    localStorage.setItem('dark', enabled ? '1' : '0');
  });
}

// auto refresh
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    console.log('Auto refresh triggered');
    loadTopHeadlines();
    // only refresh main list if visible or if user last loaded
    // to keep it simple - refresh main as well:
    loadNews();
  }, AUTO_REFRESH_MS);
}

// wire events
loadBtn.addEventListener('click', () => {
  loadNews();
  // restart auto refresh timer when user manually loads
  startAutoRefresh();
});
catButtons.forEach(b => b.addEventListener('click', () => onCategoryClick(b.dataset.cat)));

window.addEventListener('load', () => {
  initDarkMode();
  loadTopHeadlines();
  // do not auto-load main list until user clicks — but we will load top headlines
  startAutoRefresh();
});