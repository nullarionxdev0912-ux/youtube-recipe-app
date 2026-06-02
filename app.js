const API_KEY_STORAGE = 'yt_recipe_api_key';
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

let apiKey = '';

// ---- Init ----
function init() {
  apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
  if (!apiKey) {
    showScreen('setup-screen');
  } else {
    showScreen('app');
  }
  bindEvents();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ---- Events ----
function bindEvents() {
  // Setup
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  document.getElementById('api-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKey();
  });

  // Settings (reset API key)
  document.getElementById('settings-btn').addEventListener('click', () => {
    if (confirm('APIキーをリセットしますか？')) {
      localStorage.removeItem(API_KEY_STORAGE);
      location.reload();
    }
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    });
  });

  // Search
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  // URL
  document.getElementById('url-btn').addEventListener('click', handleUrl);
  document.getElementById('url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleUrl();
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
}

function saveApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val || !val.startsWith('AIza')) {
    alert('有効なAPIキーを入力してください（AIzaで始まります）');
    return;
  }
  apiKey = val;
  localStorage.setItem(API_KEY_STORAGE, apiKey);
  showScreen('app');
}

// ---- Search ----
async function handleSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  setLoading(true);
  try {
    const videos = await searchVideos(q);
    renderVideoList(videos);
  } catch (e) {
    renderError(e.message);
  } finally {
    setLoading(false);
  }
}

async function searchVideos(query) {
  const url = `${YT_API_BASE}/search?part=snippet&q=${encodeURIComponent(query + ' レシピ 作り方')}&type=video&maxResults=15&key=${apiKey}&relevanceLanguage=ja`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.items.map(item => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
  }));
}

// ---- URL ----
async function handleUrl() {
  const raw = document.getElementById('url-input').value.trim();
  const videoId = extractVideoId(raw);
  if (!videoId) {
    renderError('有効なYouTube URLを入力してください');
    return;
  }
  setLoading(true);
  try {
    const video = await fetchVideoById(videoId);
    renderVideoList([video]);
  } catch (e) {
    renderError(e.message);
  } finally {
    setLoading(false);
  }
}

function extractVideoId(url) {
  const patterns = [
    /(?:v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoById(videoId) {
  const url = `${YT_API_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.items?.length) throw new Error('動画が見つかりませんでした');
  const item = data.items[0];
  return {
    id: item.id,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
    description: item.snippet.description,
  };
}

// ---- Render List ----
function renderVideoList(videos) {
  const container = document.getElementById('results');
  if (!videos.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">😔</div><p>動画が見つかりませんでした</p></div>';
    return;
  }

  const html = `
    <p class="section-title">${videos.length}件の動画</p>
    <div class="video-list">
      ${videos.map(v => `
        <div class="video-card" data-id="${v.id}">
          <img class="video-thumb" src="${v.thumbnail}" alt="" loading="lazy" />
          <div class="video-info">
            <div class="video-title">${escHtml(v.title)}</div>
            <div class="video-channel">${escHtml(v.channel)}</div>
            <span class="recipe-badge">🍳 レシピを確認</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  container.innerHTML = html;

  container.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', () => openRecipe(card.dataset.id));
  });
}

function renderError(msg) {
  document.getElementById('results').innerHTML = `<div class="error-msg">⚠️ ${escHtml(msg)}<br><br>APIキーや入力内容を確認してください。</div>`;
}

// ---- Recipe Modal ----
async function openRecipe(videoId) {
  setLoading(true);
  try {
    const video = await fetchVideoById(videoId);
    showRecipeModal(video);
  } catch (e) {
    alert('動画情報の取得に失敗しました: ' + e.message);
  } finally {
    setLoading(false);
  }
}

function showRecipeModal(video) {
  document.getElementById('modal-title').textContent = video.title;
  document.getElementById('modal-thumbnail').innerHTML =
    `<img src="${video.thumbnail}" alt="" />`;
  document.getElementById('modal-youtube-link').href =
    `https://www.youtube.com/watch?v=${video.id}`;

  const recipe = parseRecipe(video.description || '');
  document.getElementById('modal-content').innerHTML = renderRecipe(recipe, video.description || '');

  document.getElementById('recipe-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('recipe-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- Recipe Parser ----
function parseRecipe(description) {
  const lines = description.split('\n').map(l => l.trim()).filter(l => l);

  const ingredientKeywords = /^(【?材料|具材|食材|[\*\●●]?材料|ingredients?|ingredients:|what you need)/i;
  const stepKeywords = /^(【?作り方|手順|調理手順|レシピ|作法|[\*\●]?作り方|directions?|instructions?|steps?|method|how to)/i;
  const sectionEnd = /^(【|■|▼|▶|◆|={3,}|-{3,}|#)/;

  let ingredients = [];
  let steps = [];
  let mode = null;
  let stepNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (ingredientKeywords.test(line)) { mode = 'ingredients'; continue; }
    if (stepKeywords.test(line)) { mode = 'steps'; stepNum = 0; continue; }

    // Detect section boundaries
    if (mode && sectionEnd.test(line) && !ingredientKeywords.test(line) && !stepKeywords.test(line)) {
      if (ingredients.length && steps.length) break;
    }

    if (mode === 'ingredients') {
      const clean = line.replace(/^[・•\-\*◎○●▸▹►]+\s*/, '').trim();
      if (clean && !stepKeywords.test(line) && !isTimeStamp(line)) {
        ingredients.push(clean);
      }
    } else if (mode === 'steps') {
      // numbered lines like "1." "①" etc.
      const numbered = line.match(/^[①②③④⑤⑥⑦⑧⑨⑩]|\d+[\.。\)）]/);
      const clean = line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d]+[\.。\)）]?\s*/, '').trim();
      if (clean && !ingredientKeywords.test(line) && !isTimeStamp(line) && clean.length > 3) {
        stepNum++;
        steps.push(clean);
      }
    }
  }

  // Fallback: detect numbered steps anywhere
  if (!steps.length) {
    lines.forEach(line => {
      const m = line.match(/^(\d+)[\.。\)）、]\s*(.+)/);
      if (m && m[2].length > 5 && !isTimeStamp(line)) {
        steps.push(m[2]);
      }
    });
  }

  return { ingredients, steps };
}

function isTimeStamp(line) {
  return /^\d{1,2}:\d{2}/.test(line);
}

function renderRecipe(recipe, rawDescription) {
  const hasIngredients = recipe.ingredients.length > 0;
  const hasSteps = recipe.steps.length > 0;

  if (!hasIngredients && !hasSteps) {
    return `
      <div class="no-recipe">
        <p>📄 この動画の説明文からレシピ情報を自動抽出できませんでした。</p>
        <p style="font-size:12px;margin-top:8px;color:#999">詳細はYouTube動画をご確認ください。</p>
        ${rawDescription ? `<div class="description-raw">${escHtml(rawDescription.slice(0, 800))}${rawDescription.length > 800 ? '...' : ''}</div>` : ''}
      </div>
    `;
  }

  let html = '';

  if (hasIngredients) {
    html += `
      <div class="recipe-section">
        <div class="recipe-section-title">🛒 材料</div>
        <div class="ingredient-list">
          ${recipe.ingredients.map(i => `<div class="ingredient-item">${escHtml(i)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  if (hasSteps) {
    html += `
      <div class="recipe-section">
        <div class="recipe-section-title">📝 作り方</div>
        <div class="step-list">
          ${recipe.steps.map((s, idx) => `
            <div class="step-item">
              <div class="step-num">${idx + 1}</div>
              <div class="step-text">${escHtml(s)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

// ---- Utils ----
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

init();
