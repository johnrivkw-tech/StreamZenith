/* ==========================================================================
   ZENITH STREAM — JAVASCRIPT CORE
   Consumet API & AniList GraphQL Integration
   ========================================================================== */

const ANILIST_URL = 'https://graphql.anilist.co';

// Robust, fast Consumet deployment instances (with fallbacks if one gets overloaded)
const CONSUMET_API_FALLBACKS = [
  'https://api-consumet-org-three.vercel.app',
  'https://api.consumet.org',
  'https://consumet-api-five.vercel.app'
];
let activeConsumetUrl = CONSUMET_API_FALLBACKS[0];

let activeHls = null;
let activePlyr = null;
let activeAnimeObj = null;

// Local Watchlist Memory Management
let watchlist = JSON.parse(localStorage.getItem('zenith-watchlist')) || [];

// ===== QUERIES =====
const TRENDING_ANIME_QUERY = `
  query {
    Page(page: 1, perPage: 12) {
      media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
        id
        title { romaji english }
        coverImage { extraLarge large }
        bannerImage
        description
        averageScore
        seasonYear
        episodes
        genres
      }
    }
  }
`;

const POPULAR_ANIME_QUERY = `
  query {
    Page(page: 1, perPage: 12) {
      media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
        id
        title { romaji english }
        coverImage { extraLarge large }
        averageScore
        seasonYear
        episodes
      }
    }
  }
`;

const UPCOMING_ANIME_QUERY = `
  query {
    Page(page: 1, perPage: 12) {
      media(sort: POPULARITY_DESC, type: ANIME, status: NOT_YET_RELEASED, isAdult: false) {
        id
        title { romaji english }
        coverImage { extraLarge large }
        seasonYear
      }
    }
  }
`;

const EXPLORE_GENRE_QUERY = `
  query ($genre: String) {
    Page(page: 1, perPage: 24) {
      media(genre: $genre, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
        id
        title { romaji english }
        coverImage { extraLarge large }
        averageScore
        seasonYear
      }
    }
  }
`;

const SEARCH_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 6) {
      media(search: $search, type: ANIME, isAdult: false) {
        id
        title { english romaji }
        coverImage { large }
        seasonYear
        format
      }
    }
  }
`;

// ===== ANILIST API WRAPPER =====
async function apiRequest(query, variables = {}) {
  try {
    const res = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const parsed = await res.json();
    return parsed.data;
  } catch (err) {
    console.error("GraphQL API network issue: ", err);
  }
}

// ===== CORE APP INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initAppRouter();
  loadHomepageData();
  setupSearch();
  initTheme();
  setupWatchlist();
  testConsumetInstance();
});

// Auto-test Consumet mirror endpoints
async function testConsumetInstance() {
  for (const url of CONSUMET_API_FALLBACKS) {
    try {
      const res = await fetch(`${url}/meta/anilist/info/1535`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        activeConsumetUrl = url;
        break;
      }
    } catch (e) {
      console.warn(`Consumet fallback endpoint down: ${url}`);
    }
  }
}

// Simple Router state
function initAppRouter() {
  const menuBtns = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  menuBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      menuBtns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const target = btn.dataset.target;
      document.getElementById(target).classList.add('active');
      
      // Close side panel on routing changes
      document.getElementById('details-view').classList.remove('active');
    });
  });
}

// Theme handling
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const body = document.body;

  toggle.addEventListener('click', () => {
    const current = body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', next);
    toggle.innerHTML = next === 'dark' 
      ? '<i class="fa-solid fa-sun"></i> <span>Light Mode</span>' 
      : '<i class="fa-solid fa-moon"></i> <span>Dark Mode</span>';
  });
}

// ===== HOMEPAGE LOADER =====
async function loadHomepageData() {
  const [trendingData, popularData, upcomingData] = await Promise.all([
    apiRequest(TRENDING_ANIME_QUERY),
    apiRequest(POPULAR_ANIME_QUERY),
    apiRequest(UPCOMING_ANIME_QUERY)
  ]);

  if (trendingData) {
    const trendingList = trendingData.Page.media;
    populateHeroBanner(trendingList[0]);
    document.getElementById('trendingRow').innerHTML = trendingList.map(item => generateCard(item)).join('');
  }

  if (popularData) {
    document.getElementById('popularRow').innerHTML = popularData.Page.media.map(item => generateCard(item)).join('');
  }

  if (upcomingData) {
    document.getElementById('upcomingRow').innerHTML = upcomingData.Page.media.map(item => generateCard(item)).join('');
  }
}

// Banner setup
function populateHeroBanner(anime) {
  const heroImg = document.getElementById('heroImg');
  const title = document.getElementById('heroTitle');
  const synopsis = document.getElementById('heroSynopsis');
  const stats = document.getElementById('heroStats');

  heroImg.style.backgroundImage = `url(${anime.bannerImage || anime.coverImage.extraLarge})`;
  title.textContent = anime.title.english || anime.title.romaji;
  synopsis.innerHTML = anime.description || "Explore this amazing title on ZenithStream.";

  stats.innerHTML = `
    <span><i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${anime.averageScore ? (anime.averageScore/10).toFixed(1) : 'N/A'}</span>
    <span>• ${anime.seasonYear || 'Upcoming'}</span>
    <span>• ${anime.episodes ? anime.episodes + ' Episodes' : 'Airing'}</span>
  `;

  // Action listeners
  document.getElementById('heroPlayBtn').onclick = () => openAnimePanel(anime.id);
  document.getElementById('heroInfoBtn').onclick = () => openAnimePanel(anime.id);
}

// Template Generator
function generateCard(anime) {
  const score = anime.averageScore ? (anime.averageScore/10).toFixed(1) : null;
  const title = anime.title.english || anime.title.romaji;

  return `
    <div class="anime-card" onclick="openAnimePanel(${anime.id})">
      <div class="card-img-wrap">
        <img src="${anime.coverImage.extraLarge || anime.coverImage.large}" alt="${title}" loading="lazy" />
        ${score ? `<div class="card-score"><i class="fa-solid fa-star"></i> ${score}</div>` : ''}
        <div class="card-overlay">
          <div class="card-hover-info">
            <h4>${title}</h4>
          </div>
        </div>
      </div>
      <div class="card-title">${title}</div>
      <div class="card-subtitle">${anime.seasonYear || 'N/A'}</div>
    </div>
  `;
}

// ===== SLIDE-OVER ANIME PANEL LOGIC =====
async function openAnimePanel(id) {
  const panel = document.getElementById('details-view');
  panel.classList.add('active');

  const panelHero = document.getElementById('panelHero');
  const panelPoster = document.getElementById('panelPoster');
  const panelTitle = document.getElementById('panelTitle');
  const panelMeta = document.getElementById('panelMeta');
  const panelGenres = document.getElementById('panelGenres');
  const panelDesc = document.getElementById('panelDesc');

  // Load animation skeletons
  panelHero.style.backgroundImage = '';
  panelPoster.innerHTML = `<div style="height:100%; width:100%; background:var(--bg-card);"></div>`;
  panelTitle.textContent = "Loading info...";
  panelMeta.innerHTML = '';
  panelGenres.innerHTML = '';
  panelDesc.textContent = '';

  // Get details from AniList first
  const data = await apiRequest(`
    query($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        coverImage { extraLarge }
        bannerImage
        description
        seasonYear
        episodes
        averageScore
        genres
        studios(isMain: true) { nodes { name } }
      }
    }
  `, { id });

  if (!data) return;
  const mediaObj = data.Media;
  activeAnimeObj = mediaObj;

  const titleText = mediaObj.title.english || mediaObj.title.romaji;
  panelHero.style.backgroundImage = `url(${mediaObj.bannerImage || mediaObj.coverImage.extraLarge})`;
  panelPoster.innerHTML = `<img src="${mediaObj.coverImage.extraLarge}" alt="${titleText}" />`;
  panelTitle.textContent = titleText;
  panelDesc.innerHTML = mediaObj.description || "No description currently available.";

  panelMeta.innerHTML = `
    <span><i class="fa-solid fa-star" style="color:#fbbf24;"></i> ${mediaObj.averageScore ? (mediaObj.averageScore/10).toFixed(1) : 'N/A'}</span>
    <span>• ${mediaObj.seasonYear || 'Upcoming'}</span>
    <span>• ${mediaObj.episodes ? mediaObj.episodes + ' Episodes' : 'Airing'}</span>
    <span>• ${mediaObj.studios.nodes[0] ? mediaObj.studios.nodes[0].name : 'N/A'}</span>
  `;

  panelGenres.innerHTML = mediaObj.genres.map(g => `<span class="panel-genre-tag">${g}</span>`).join('');

  updateWatchlistBtn();

  // Load episodes from Consumet Streaming Engine
  loadEpisodesGrid(id);
}

// Close panel listener
document.getElementById('closePanelBtn').onclick = () => {
  document.getElementById('details-view').classList.remove('active');
};

// ===== STREAMING ENGINE INTERFACE =====
async function loadEpisodesGrid(anilistId) {
  const epGrid = document.getElementById('epGrid');
  const epLoading = document.getElementById('epLoading');

  epGrid.innerHTML = '';
  epLoading.textContent = "Querying live streaming directories...";
  epLoading.style.display = "block";

  try {
    const res = await fetch(`${activeConsumetUrl}/meta/anilist/info/${anilistId}`);
    const data = await res.json();

    if (data && data.episodes && data.episodes.length > 0) {
      epLoading.style.display = "none";
      epGrid.innerHTML = data.episodes.map(ep => `
        <button class="ep-btn" onclick="openTheaterMode('${ep.id}', ${ep.number})">
          ${ep.number}
        </button>
      `).join('');

      // Cache current episode lists to play next
      epGrid.dataset.epList = JSON.stringify(data.episodes);
    } else {
      epLoading.textContent = "No streaming sources currently matched on Gogoanime/Zoro.";
    }
  } catch (err) {
    console.error("Episode mapping failed: ", err);
    epLoading.textContent = "Streaming service is currently resolving links. Retry in a moment.";
  }
}

// ===== IMMERSIVE THEATER SYSTEM =====
async function openTheaterMode(episodeId, epNumber) {
  const theater = document.getElementById('theater-view');
  const title = document.getElementById('theaterTitle');
  const epTitle = document.getElementById('theaterEpTitle');
  const epListWrap = document.getElementById('theaterEpList');

  const rawList = document.getElementById('epGrid').dataset.epList;
  const parsedList = rawList ? JSON.parse(rawList) : [];

  theater.classList.add('active');
  document.body.style.overflow = 'hidden';

  title.textContent = activeAnimeObj.title.english || activeAnimeObj.title.romaji;
  epTitle.textContent = `Episode ${epNumber}`;

  // Populate interactive Sidebar inside video theater room
  epListWrap.innerHTML = parsedList.map(ep => `
    <button class="theater-ep-item ${ep.number === epNumber ? 'active' : ''}" onclick="openTheaterMode('${ep.id}', ${ep.number})">
      Episode ${ep.number}
    </button>
  `).join('');

  // Start Streaming resource
  initStream(episodeId);
}

async function initStream(episodeId) {
  const video = document.getElementById('zenithPlayer');
  
  if (activePlyr) {
    activePlyr.destroy();
  }
  if (activeHls) {
    activeHls.destroy();
  }

  try {
    const res = await fetch(`${activeConsumetUrl}/meta/anilist/watch/${episodeId}`);
    const data = await res.json();

    // Use auto/adaptive quality or select highest priority source
    const optimalSource = data.sources.find(s => s.quality === 'default' || s.quality === 'auto') || data.sources[0];
    const streamUrl = optimalSource.url;

    if (Hls.isSupported()) {
      activeHls = new Hls();
      activeHls.loadSource(streamUrl);
      activeHls.attachMedia(video);
      activeHls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari Native stream pipeline
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play();
      });
    }

    // Modern custom player controls
    activePlyr = new Plyr(video, {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 
        'duration', 'mute', 'volume', 'captions', 'settings', 
        'pip', 'fullscreen'
      ],
      settings: ['quality', 'speed']
    });

  } catch (err) {
    console.error("Video streaming setup threw error: ", err);
    alert("Streaming link currently failed to load. Please try back soon.");
  }
}

// Exit Theater Handler
document.getElementById('exitTheaterBtn').onclick = () => {
  const theater = document.getElementById('theater-view');
  const video = document.getElementById('zenithPlayer');

  if (activePlyr) activePlyr.destroy();
  if (activeHls) activeHls.destroy();

  video.src = '';
  theater.classList.remove('active');
  document.body.style.overflow = '';
};

// ===== INTERACTIVE INSTANT SEARCH =====
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  let debounceTimeout;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    const text = searchInput.value.trim();

    if (text.length < 2) {
      dropdown.classList.remove('active');
      return;
    }

    debounceTimeout = setTimeout(async () => {
      const data = await apiRequest(SEARCH_QUERY, { search: text });
      if (data && data.Page.media.length > 0) {
        dropdown.innerHTML = data.Page.media.map(anime => `
          <div class="search-item" onclick="handleSearchSelect(${anime.id})">
            <img src="${anime.coverImage.large}" alt="${anime.title.english || anime.title.romaji}" />
            <div class="search-item-info">
              <h4>${anime.title.english || anime.title.romaji}</h4>
              <span>${anime.format || 'TV'} • ${anime.seasonYear || 'N/A'}</span>
            </div>
          </div>
        `).join('');
        dropdown.classList.add('active');
      } else {
        dropdown.innerHTML = '<div style="padding:15px; color:var(--text-muted); font-size:0.9rem;">No results found...</div>';
        dropdown.classList.add('active');
      }
    }, 450);
  });

  // Tap background to hide
  document.addEventListener('click', (e) => {
    if (!document.querySelector('.search-container').contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });
}

function handleSearchSelect(id) {
  document.getElementById('searchDropdown').classList.remove('active');
  document.getElementById('searchInput').value = '';
  openAnimePanel(id);
}

// ===== WATCHLIST MANAGER (Local Storage) =====
function setupWatchlist() {
  const genres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
    'Mystery', 'Romance', 'Sci-Fi', 'Sports', 'Supernatural'
  ];

  // Populates Genre selector on Explore View
  document.getElementById('genreFilterContainer').innerHTML = genres.map(g => `
    <button class="genre-bubble" onclick="filterGenre('${g}', this)">${g}</button>
  `).join('');

  // Auto load first default genre search on Explore View
  filterGenre(genres[0], document.querySelector('.genre-bubble'));

  // Render initial list
  renderWatchlist();
}

async function filterGenre(genre, element) {
  document.querySelectorAll('.genre-bubble').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');

  const exploreGrid = document.getElementById('exploreGrid');
  exploreGrid.innerHTML = '<p style="color:var(--text-muted)">Discovering titles...</p>';

  const data = await apiRequest(EXPLORE_GENRE_QUERY, { genre });
  if (data) {
    exploreGrid.innerHTML = data.Page.media.map(anime => generateCard(anime)).join('');
  }
}

// Watchlist operations
function updateWatchlistBtn() {
  const btn = document.getElementById('panelWatchlistBtn');
  const isBookmarked = watchlist.some(x => x.id === activeAnimeObj.id);

  if (isBookmarked) {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> On Watchlist';
    btn.className = "btn btn-dark";
    btn.onclick = removeFromWatchlist;
  } else {
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Watchlist';
    btn.className = "btn btn-purple";
    btn.onclick = addToWatchlist;
  }
}

function addToWatchlist() {
  if (!watchlist.some(x => x.id === activeAnimeObj.id)) {
    watchlist.push({
      id: activeAnimeObj.id,
      title: activeAnimeObj.title,
      coverImage: activeAnimeObj.coverImage,
      averageScore: activeAnimeObj.averageScore,
      seasonYear: activeAnimeObj.seasonYear
    });
    localStorage.setItem('zenith-watchlist', JSON.stringify(watchlist));
    updateWatchlistBtn();
    renderWatchlist();
  }
}

function removeFromWatchlist() {
  watchlist = watchlist.filter(x => x.id !== activeAnimeObj.id);
  localStorage.setItem('zenith-watchlist', JSON.stringify(watchlist));
  updateWatchlistBtn();
  renderWatchlist();
}

function renderWatchlist() {
  const container = document.getElementById('watchlistGrid');
  if (watchlist.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1;">Your saved list is empty.</p>';
    return;
  }
  container.innerHTML = watchlist.map(anime => generateCard(anime)).join('');
                  }
