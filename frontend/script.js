// script.js — simple frontend that calls your backend /api/news
const loadBtn = document.getElementById('load');
const qInput = document.getElementById('q');
const langSel = document.getElementById('lang');
const maxInput = document.getElementById('max');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

// <-- set your Render backend URL here
const API_BASE = 'https://fetchapi-new-app.onrender.com';

async function loadNews() {
  statusEl.textContent = 'Loading...';
  resultsEl.innerHTML = '';

  const q = qInput.value.trim();
  const lang = langSel.value || 'en';
  const max = parseInt(maxInput.value, 10) || 10;

  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (lang) params.append('lang', lang);
  params.append('max', String(max));

  try {
    const res = await fetch(`${API_BASE}/api/news?` + params.toString());
    if (!res.ok) throw new Error('Server error: ' + res.status);
    const payload = await res.json();
    const articles = payload.articles || [];

    if (articles.length === 0) {
      statusEl.textContent = 'No articles found.';
      return;
    }

    statusEl.textContent = `Showing ${articles.length} articles.`;
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
      anchor.href = a.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = a.title || 'Untitled';
      title.appendChild(anchor);

      const desc = document.createElement('p');
      desc.textContent = a.description || '';

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${a.source || 'Unknown'} • ${a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ''}`;

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(meta);

      resultsEl.appendChild(card);
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error loading news. See console.';
    resultsEl.innerHTML = `<div class="card">Error: ${err.message}</div>`;
  }
}

loadBtn.addEventListener('click', loadNews);