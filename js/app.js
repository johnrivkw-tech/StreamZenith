/* ============================================
   ANIVERSE — COMPLETE JAVASCRIPT
   AniList GraphQL API Integration
   ============================================ */

const API_URL = 'https://graphql.anilist.co';

// ===== GRAPHQL QUERIES =====
const QUERIES = {
  trending: `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          id
          title { romaji english }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          averageScore
          meanScore
          popularity
          favourites
          episodes
          format
          status
          season
          seasonYear
          genres
          studios(isMain: true) { nodes { name } }
          trailer { id site }
          nextAiringEpisode { episode timeUntilAiring }
        }
      }
    }
  `,
  popular: `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          id title { romaji english }
          coverImage { extraLarge large }
          bannerImage description(asHtml: false)
          averageScore popularity favourites episodes
          format status season seasonYear genres
          studios(isMain: true) { nodes { name } }
          trailer { id site }
        }
      }
    }
  `,
  upcoming: `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, status: NOT_YET_RELEASED, season: $season, seasonYear: $seasonYear, isAdult: false) {
          id title { romaji english }
          coverImage { extraLarge large }
          bannerImage description(asHtml: false)
          averageScore popularity favourites episodes
          format status season seasonYear genres
          studios(isMain: true) { nodes { name } }
          trailer { id site }
        }
      }
    }
  `,
  search: `
    query ($search: String) {
      Page(page: 1, perPage: 8) {
        media(search: $search, type: ANIME, isAdult: false) {
          id title { romaji english }
          coverImage { large }
          format seasonYear averageScore
        }
      }
    }
  `,
  details: `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id title { romaji english native }
        coverImage { extraLarge large }
        bannerImage
        description(asHtml: false)
        averageScore meanScore popularity favourites
        episodes duration format status
        season seasonYear
        genres source
        studios(isMain: true) { nodes { name } }
        trailer { id site }
        characters(sort: ROLE, page: 1, perPage: 12) {
          nodes {
            name { full }
            image { medium }
          }
        }
        relations {
          edges {
            relationType
            node {
              id title { romaji }
              coverImage { large }
              format type
            }
          }
        }
        nextAiringEpisode { episode timeUntilAiring }
      }
    }
  `,
  genre: `
    query ($page: Int, $perPage: Int, $genre: String) {
      Page(page: $page, perPage: $perPage) {
        media(genre: $genre, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          id title { romaji english }
          coverImage { extraLarge large }
          averageScore popularity episodes
          format status season seasonYear genres
        }
      }
    }
  `
};

// ===== API FETCH =====
async function fetchAniList(query, variables = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('AniList API Error:', error);
    return null;
  }
}

// ===== UTILITY FUNCTIONS =====
function getTitle(media) {
  return media.title.english || media.title.romaji || 'Unknown';
}

function cleanDescription(desc) {
  if (!desc) return 'No description available.';
  return desc.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getNextSeason() {
  const month = new Date().getMonth();
  const year = new Date().getFullYear();
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const currentSeasonIndex = Math.floor(month / 3);
  const nextIndex = (currentSeasonIndex + 1) % 4;
  const nextYear = nextIndex === 0 ? year + 1 : year;
  return { season: seasons[nextIndex], year: nextYear };
}

function createSkeletonCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text-sm"></div>
      </div>
    `;
  }
  return html;
}

// ===== ANIME CARD COMPONENT =====
function createAnimeCard(anime) {
  const title = getTitle(anime);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const cover = anime.coverImage.extraLarge || anime.coverImage.large;
  const format = anime.format || '';
  const year = anime.seasonYear || '';
  const episodes = anime.episodes ? `${anime.episodes} eps` : '';

  return `
    <div class="anime-card" data-id="${anime.id}" onclick="openAnimeModal(${anime.id})">
      <div class="anime-card-image">
        <img src="${cover}" alt="${title}" loading="lazy" />
        ${anime.averageScore ? `<div class="anime-card-score"><i class="fas fa-star"></i> ${score}</div>` : ''}
        ${format ? `<div class="anime-card-format">${format}</div>` : ''}
        <div class="anime-card-overlay">
          <div class="play-icon"><i class="fas fa-info"></i></div>
        </div>
      </div>
      <div class="anime-card-info">
        <div class="anime-card-title">${title}</div>
        <div class="anime-card-meta">
          ${year ? `<span>${year}</span>` : ''}
          ${episodes ? `<span>${episodes}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ===== INITIALIZE SECTIONS =====
let heroAnime = null;

async function initHero(animeList) {
  if (!animeList || animeList.length === 0) return;
  heroAnime = animeList[0];
  const heroBg = document.getElementById('heroBg');
  const heroTitle = document.getElementById('heroTitle');
  const heroDesc = document.getElementById('heroDesc');
  const heroMeta = document.getElementById('heroMeta');

  const bg = heroAnime.bannerImage || heroAnime.coverImage.extraLarge;
  heroBg.style.backgroundImage = `url(${bg})`;
  heroTitle.textContent = getTitle(heroAnime);
  heroDesc.textContent = cleanDescription(heroAnime.description);

  const studio = heroAnime.studios?.nodes?.[0]?.name || '';
  const score = heroAnime.averageScore ? `${(heroAnime.averageScore / 10).toFixed(1)}` : '';
  const eps = heroAnime.episodes ? `${heroAnime.episodes} Episodes` : '';
  const season = heroAnime.season && heroAnime.seasonYear
    ? `${heroAnime.season.charAt(0) + heroAnime.season.slice(1).toLowerCase()} ${heroAnime.seasonYear}` : '';

  heroMeta.innerHTML = `
    ${score ? `<div class="hero-meta-item"><i class="fas fa-star"></i> ${score}</div>` : ''}
    ${studio ? `<div class="hero-meta-item"><i class="fas fa-building"></i> ${studio}</div>` : ''}
    ${eps ? `<div class="hero-meta-item"><i class="fas fa-tv"></i> ${eps}</div>` : ''}
    ${season ? `<div class="hero-meta-item"><i class="fas fa-calendar"></i> ${season}</div>` : ''}
    ${heroAnime.genres ? `<div class="hero-meta-item"><i class="fas fa-tag"></i> ${heroAnime.genres.slice(0, 3).join(', ')}</div>` : ''}
  `;
}

async function initTrending() {
  const grid = document.getElementById('trendingGrid');
  grid.innerHTML = createSkeletonCards(8);
  const data = await fetchAniList(QUERIES.trending, { page: 1, perPage: 20 });
  if (data) {
    const animeList = data.Page.media;
    initHero(animeList);
    grid.innerHTML = animeList.map(createAnimeCard).join('');
  }
}

async function initPopular() {
  const grid = document.getElementById('popularGrid');
  grid.innerHTML = createSkeletonCards(8);
  const data = await fetchAniList(QUERIES.popular, { page: 1, perPage: 20 });
  if (data) {
    grid.innerHTML = data.Page.media.map(createAnimeCard).join('');
  }
}

async function initUpcoming() {
  const grid = document.getElementById('upcomingGrid');
  grid.innerHTML = createSkeletonCards(8);
  const next = getNextSeason();
  const data = await fetchAniList(QUERIES.upcoming, { page: 1, perPage: 20, season: next.season, seasonYear: next.year });
  if (data && data.Page.media.length > 0) {
    grid.innerHTML = data.Page.media.map(createAnimeCard).join('');
  } else {
    // Fallback: get any upcoming anime
    const fallback = await fetchAniList(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(sort: POPULARITY_DESC, type: ANIME, status: NOT_YET_RELEASED, isAdult: false) {
            id title { romaji english }
            coverImage { extraLarge large }
            averageScore popularity episodes format status season seasonYear genres
          }
        }
      }
    `, { page: 1, perPage: 20 });
    if (fallback) {
      grid.innerHTML = fallback.Page.media.map(createAnimeCard).join('');
    }
  }
}

function initGenres() {
  const genres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
    'Horror', 'Mecha', 'Music', 'Mystery', 'Psychological',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
    'Supernatural', 'Thriller'
  ];

  const grid = document.getElementById('genreGrid');
  grid.innerHTML = genres.map(g => `
    <div class="genre-tag" data-genre="${g}" onclick="selectGenre('${g}', this)">
      <span>${g}</span>
    </div>
  `).join('');
}

async function selectGenre(genre, el) {
  document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  const results = document.getElementById('genreResults');
  results.style.display = 'grid';
  results.innerHTML = createSkeletonCards(12);

  const data = await fetchAniList(QUERIES.genre, { page: 1, perPage: 18, genre });
  if (data) {
    results.innerHTML = data.Page.media.map(createAnimeCard).join('');
  }
}

// ===== ANIME DETAIL MODAL =====
async function openAnimeModal(id) {
  const modal = document.getElementById('animeModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const data = await fetchAniList(QUERIES.details, { id });
  if (!data) return;

  const anime = data.Media;
  const title = getTitle(anime);

  document.getElementById('modalBanner').style.backgroundImage =
    `url(${anime.bannerImage || anime.coverImage.extraLarge})`;
  document.getElementById('modalPoster').innerHTML =
    `<img src="${anime.coverImage.extraLarge || anime.coverImage.large}" alt="${title}" />`;
  document.getElementById('modalTitle').textContent = title;

  const studio = anime.studios?.nodes?.[0]?.name || '';
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const status = anime.status ? anime.status.replace(/_/g, ' ') : '';

  document.getElementById('modalMeta').innerHTML = `
    <div class="modal-meta-item"><i class="fas fa-star"></i> ${score}</div>
    ${studio ? `<div class="modal-meta-item"><i class="fas fa-building"></i> ${studio}</div>` : ''}
    ${anime.episodes ? `<div class="modal-meta-item"><i class="fas fa-tv"></i> ${anime.episodes} eps</div>` : ''}
    ${anime.duration ? `<div class="modal-meta-item"><i class="fas fa-clock"></i> ${anime.duration} min</div>` : ''}
    <div class="modal-meta-item"><i class="fas fa-signal"></i> ${status}</div>
    ${anime.season ? `<div class="modal-meta-item"><i class="fas fa-calendar"></i> ${anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} ${anime.seasonYear || ''}</div>` : ''}
  `;

  document.getElementById('modalGenres').innerHTML =
    (anime.genres || []).map(g => `<span class="modal-genre-tag">${g}</span>`).join('');

  document.getElementById('modalDesc').textContent = cleanDescription(anime.description);

  document.getElementById('modalStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${score}</div>
      <div class="stat-label">Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(anime.popularity)}</div>
      <div class="stat-label">Popularity</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(anime.favourites)}</div>
      <div class="stat-label">Favourites</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${anime.episodes || '?'}</div>
      <div class="stat-label">Episodes</div>
    </div>
  `;

  // Characters
  const chars = anime.characters?.nodes || [];
  if (chars.length > 0) {
    document.getElementById('modalCharacters').innerHTML = `
      <h3>Characters</h3>
      <div class="characters-grid">
        ${chars.map(c => `
          <div class="character-card">
            <img src="${c.image.medium}" alt="${c.name.full}" loading="lazy" />
            <span>${c.name.full}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    document.getElementById('modalCharacters').innerHTML = '';
  }

  // Relations
  const relations = anime.relations?.edges?.filter(e => e.node.type === 'ANIME') || [];
  if (relations.length > 0) {
    document.getElementById('modalRelations').innerHTML = `
      <h3>Related Anime</h3>
      <div class="relations-grid">
        ${relations.map(r => `
          <div class="relation-card" onclick="openAnimeModal(${r.node.id})">
            <img src="${r.node.coverImage.large}" alt="${r.node.title.romaji}" loading="lazy" />
            <div class="relation-type">${r.relationType.replace(/_/g, ' ')}</div>
            <span>${r.node.title.romaji}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    document.getElementById('modalRelations').innerHTML = '';
  }

  // Store trailer info
  modal.dataset.trailerId = anime.trailer?.id || '';
  modal.dataset.trailerSite = anime.trailer?.site || '';
}

function closeAnimeModal() {
  document.getElementById('animeModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ===== TRAILER MODAL =====
function openTrailer(id, site) {
  if (!id) return alert('No trailer available for this anime.');
  const modal = document.getElementById('trailerModal');
  const player = document.getElementById('trailerPlayer');

  if (site === 'youtube') {
    player.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allowfullscreen allow="autoplay"></iframe>`;
  } else if (site === 'dailymotion') {
    player.innerHTML = `<iframe src="https://www.dailymotion.com/embed/video/${id}?autoplay=1" allowfullscreen allow="autoplay"></iframe>`;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeTrailer() {
  const modal = document.getElementById('trailerModal');
  document.getElementById('trailerPlayer').innerHTML = '';
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ===== SEARCH =====
let searchTimeout;
const searchInput = document.getElementById('searchInput');
const searchWrapper = document.getElementById('searchWrapper');
const searchResults = document.getElementById('searchResults');
const searchBtn = document.getElementById('searchBtn');

searchBtn.addEventListener('click', () => {
  searchWrapper.classList.toggle('active');
  if (searchWrapper.classList.contains('active')) {
    searchInput.focus();
  } else {
    searchInput.value = '';
    searchResults.classList.remove('active');
  }
});

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  if (query.length < 2) {
    searchResults.classList.remove('active');
    return;
  }
  searchTimeout = setTimeout(async () => {
    const data = await fetchAniList(QUERIES.search, { search: query });
    if (data && data.Page.media.length > 0) {
      searchResults.innerHTML = data.Page.media.map(a => `
        <div class="search-item" onclick="openAnimeModal(${a.id}); searchWrapper.classList.remove('active'); searchResults.classList.remove('active');">
          <img src="${a.coverImage.large}" alt="${getTitle(a)}" />
          <div class="search-item-info">
            <h4>${getTitle(a)}</h4>
            <span>${a.format || ''} ${a.seasonYear ? `• ${a.seasonYear}` : ''} ${a.averageScore ? `• ⭐ ${(a.averageScore/10).toFixed(1)}` : ''}</span>
          </div>
        </div>
      `).join('');
      searchResults.classList.add('active');
    } else {
      searchResults.innerHTML = '<div class="search-no-results">No anime found</div>';
      searchResults.classList.add('active');
    }
  }, 400);
});

// Close search on outside click
document.addEventListener('click', (e) => {
  if (!searchWrapper.contains(e.target)) {
    searchResults.classList.remove('active');
  }
});

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('aniverse-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('aniverse-theme', next);
  updateThemeIcon(next);
});

function updateThemeIcon(theme) {
  const icon = themeToggle.querySelector('i');
  icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ===== NAVBAR SCROLL =====
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  const backToTop = document.getElementById('backToTop');

  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  if (window.scrollY > 500) {
    backToTop.classList.add('visible');
  } else {
    backToTop.classList.remove('visible');
  }
});

// ===== BACK TO TOP =====
document.getElementById('backToTop').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== MOBILE MENU =====
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('active');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.getElementById('navLinks').classList.remove('active');

    const section = link.dataset.section;
    if (section === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(section);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== SCROLL BUTTONS =====
document.querySelectorAll('.scroll-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const dir = parseInt(btn.dataset.dir);
    target.scrollBy({ left: dir * 600, behavior: 'smooth' });
  });
});

// ===== MODAL CLOSE EVENTS =====
document.getElementById('modalClose').addEventListener('click', closeAnimeModal);
document.getElementById('modalBackdrop').addEventListener('click', closeAnimeModal);
document.getElementById('trailerClose').addEventListener('click', closeTrailer);
document.getElementById('trailerBackdrop').addEventListener('click', closeTrailer);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAnimeModal();
    closeTrailer();
  }
});

// ===== HERO BUTTONS =====
document.getElementById('heroDetailsBtn').addEventListener('click', () => {
  if (heroAnime) openAnimeModal(heroAnime.id);
});

document.getElementById('heroTrailerBtn').addEventListener('click', () => {
  if (heroAnime?.trailer?.id) {
    openTrailer(heroAnime.trailer.id, heroAnime.trailer.site);
  } else {
    alert('No trailer available for this anime.');
  }
});

// ===== INIT APP =====
async function initApp() {
  await Promise.all([initTrending(), initPopular(), initUpcoming()]);
  initGenres();

  // Hide preloader
  setTimeout(() => {
    document.getElementById('preloader').classList.add('hidden');
  }, 800);
}

// Start the app
initApp();
