// public/resources.js

const resourceListEl = document.getElementById('resourceList');
const statusEl = document.getElementById('status');

const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category');
const difficultySelect = document.getElementById('difficulty');
const typeSelect = document.getElementById('type');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');

(function loadSavedResourceFilters() {
  const saved = JSON.parse(localStorage.getItem("resourceFilters"));
  if (!saved) return;

  searchInput.value = saved.search || "";
  categorySelect.value = saved.category || "";
  difficultySelect.value = saved.difficulty || "";
  typeSelect.value = saved.type || "";
})();

// ===== Helper to build query string for backend =====
function buildQueryString() {
  const params = new URLSearchParams();

  if (searchInput.value.trim() !== '') {
    params.append('search', searchInput.value.trim());
  }
  if (categorySelect.value) {
    // we assume this matches ResourceCategory.slug (e.g. "strength")
    params.append('category', categorySelect.value);
  }
  if (difficultySelect.value) {
    params.append('difficulty', difficultySelect.value);
  }
  if (typeSelect.value) {
    params.append('type', typeSelect.value);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ===== Fetch from backend instead of localStorage =====
async function fetchResources() {
  const queryString = buildQueryString();

  statusEl.textContent = 'Loading resources...';
  statusEl.classList.remove('error');

  try {
    // ⚠️ If your router is mounted at e.g. `/api/resources`,
    // change this to `/api/resources${queryString}`
    const res = await fetch(`/resources${queryString}`);

    if (!res.ok) {
      throw new Error(`Failed to fetch resources: ${res.status}`);
    }

    const resources = await res.json();

    statusEl.textContent = `${resources.length} resource(s) found.`;
    renderResources(resources);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load resources. Please try again.';
    statusEl.classList.add('error');
    renderResources([]); // clear list on error
  }
}

// ===== Render cards (adapted for Prisma shape) =====
function renderResources(resources) {
  resourceListEl.innerHTML = '';

  if (!resources || resources.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No resources found. Try adjusting your filters.';
    resourceListEl.appendChild(emptyMsg);
    return;
  }

  resources.forEach((r) => {
    const card = document.createElement('article');
    card.className = 'resource-card';

    const header = document.createElement('div');
    header.className = 'resource-header';

    const title = document.createElement('h2');
    title.className = 'resource-title';
    title.textContent = r.title || 'Untitled resource';

    const badges = document.createElement('div');
    badges.className = 'resource-badges';

    // Type badge (ARTICLE / VIDEO / LINK / PDF)
    if (r.type) {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge badge-type';
      typeBadge.textContent = r.type;
      badges.appendChild(typeBadge);
    }

    // Difficulty badge (BEGINNER / INTERMEDIATE / ADVANCED)
    if (r.difficulty) {
      const difBadge = document.createElement('span');
      difBadge.className = 'badge badge-difficulty';
      difBadge.textContent = r.difficulty;
      badges.appendChild(difBadge);
    }

    // Category badge (using related ResourceCategory)
    // Prisma returns: r.category = { id, name, slug, ... }
    const categoryLabel =
      (r.category && (r.category.name || r.category.slug)) ||
      r.categoryLabel || // fallback if you ever send plain label
      null;

    if (categoryLabel) {
      const catBadge = document.createElement('span');
      catBadge.className = 'badge badge-category';
      catBadge.textContent = categoryLabel;
      badges.appendChild(catBadge);
    }

    header.appendChild(title);
    header.appendChild(badges);

    const desc = document.createElement('p');
    desc.className = 'resource-description';
    desc.textContent =
      r.description ||
      'No description provided. This resource will be updated soon.';

    const footer = document.createElement('div');
    footer.className = 'resource-footer';

    const link = document.createElement('a');
    link.className = 'resource-link';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = r.type === 'VIDEO' ? 'Watch' : 'Open resource';
    link.href = r.url || '#';

    const meta = document.createElement('span');
    meta.textContent = r.createdAt
      ? `Added: ${new Date(r.createdAt).toLocaleDateString()}`
      : '';

    footer.appendChild(link);
    footer.appendChild(meta);

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(footer);

    resourceListEl.appendChild(card);
  });
}

// ===== Static Fitness News Carousel (unchanged) =====
const fitnessNews = [
  {
    id: 1,
    title: "New Study: Shorter, High-Intensity Workouts Improve VO₂ Max",
    summary:
      "Researchers found that 15-minute HIIT sessions, 3 times a week, significantly improved cardiovascular fitness in adults with busy schedules.",
    image: "https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg",
    url: "https://example.com/hiit-study",
    tag: "Research",
  },
  {
    id: 2,
    title: "Why Sleep Might Be Your Secret Muscle-Building Tool",
    summary:
      "Coaches emphasize that 7–9 hours of sleep can be just as important as protein intake and training volume for muscle growth.",
    image: "https://images.pexels.com/photos/1433227/pexels-photo-1433227.jpeg",
    url: "https://example.com/sleep-muscle",
    tag: "Recovery",
  },
  {
    id: 3,
    title: "Beginner’s Guide to Progressive Overload in the Gym",
    summary:
      "A practical framework to add weight, reps, or sets over time without burning out or getting injured.",
    image: "https://images.pexels.com/photos/1552102/pexels-photo-1552102.jpeg",
    url: "https://example.com/progressive-overload",
    tag: "Strength",
  },
  {
    id: 4,
    title: "Plant-Based Protein: Can It Support Strength Goals?",
    summary:
      "Dietitians discuss how to hit protein targets using tofu, tempeh, beans and protein blends while maintaining performance.",
    image: "https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg",
    url: "https://example.com/plant-protein",
    tag: "Nutrition",
  },
];

const newsCarouselEl = document.getElementById('newsCarousel');
const newsPrevBtn = document.getElementById('newsPrevBtn');
const newsNextBtn = document.getElementById('newsNextBtn');

let currentNewsIndex = 0;
let newsIntervalId = null;

function renderNewsCarousel() {
  if (!newsCarouselEl) return;

  newsCarouselEl.innerHTML = '';

  fitnessNews.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-card';

    const img = document.createElement('div');
    img.className = 'news-image';
    img.style.backgroundImage = `url(${item.image})`;

    const content = document.createElement('div');
    content.className = 'news-content';

    const tag = document.createElement('span');
    tag.className = 'news-tag';
    tag.textContent = item.tag;

    const title = document.createElement('h3');
    title.className = 'news-title';
    title.textContent = item.title;

    const summary = document.createElement('p');
    summary.className = 'news-summary';
    summary.textContent = item.summary;

    const link = document.createElement('a');
    link.className = 'news-link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Read more';

    content.appendChild(tag);
    content.appendChild(title);
    content.appendChild(summary);
    content.appendChild(link);

    card.appendChild(img);
    card.appendChild(content);

    newsCarouselEl.appendChild(card);
  });

  setActiveNewsSlide(0);
  startNewsAutoRotate();
}

function setActiveNewsSlide(index) {
  const cards = newsCarouselEl.querySelectorAll('.news-card');
  if (!cards.length) return;

  const total = cards.length;
  currentNewsIndex = (index + total) % total;

  cards.forEach((card, i) => {
    card.classList.toggle('active', i === currentNewsIndex);
  });
}

function showNews(direction) {
  const delta = direction === 'next' ? 1 : -1;
  setActiveNewsSlide(currentNewsIndex + delta);
}

function startNewsAutoRotate() {
  if (newsIntervalId) clearInterval(newsIntervalId);
  newsIntervalId = setInterval(() => {
    showNews('next');
  }, 5000);
}

if (newsPrevBtn && newsNextBtn) {
  newsPrevBtn.addEventListener('click', () => {
    showNews('prev');
    startNewsAutoRotate();
  });
  newsNextBtn.addEventListener('click', () => {
    showNews('next');
    startNewsAutoRotate();
  });
}

// When user clicks "Abs", "Back", etc → remember mapping state
document.querySelectorAll(".exercise-entry-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    localStorage.setItem("fromResourcesPage", "true");
  });
});

// ===== Event listeners =====
applyFiltersBtn.addEventListener('click', (e) => {
  e.preventDefault();
  fetchResources();
  localStorage.setItem("resourceFilters", JSON.stringify({
  search: searchInput.value.trim(),
  category: categorySelect.value,
  difficulty: difficultySelect.value,
  type: typeSelect.value,
}));
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    fetchResources();
  }
});

const resetResourceBtn = document.getElementById("resetResourceFiltersBtn");

resetResourceBtn.addEventListener("click", () => {
  // 1. Clear UI filter inputs
  searchInput.value = "";
  categorySelect.value = "";
  difficultySelect.value = "";
  typeSelect.value = "";

  // 2. Clear saved filter states
  localStorage.removeItem("resourceFilters");
  localStorage.removeItem("fromResourcesPage"); // Just in case

  // 3. Reload page without ANY query string
  const cleanUrl = window.location.origin + window.location.pathname;
  window.location.href = cleanUrl;
});

// ===== Initial load =====
fetchResources();
renderNewsCarousel();
