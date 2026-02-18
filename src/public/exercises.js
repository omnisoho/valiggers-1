let allExercises = [];
let featuredInterval = null;


const exerciseListEl = document.getElementById('exerciseList');
const featuredEl = document.getElementById('featuredExercise');
const statusEl = document.getElementById('exerciseStatus');

const searchInput = document.getElementById('exerciseSearch');
const bodyPartSelect = document.getElementById('exerciseBodyPart');
const difficultySelect = document.getElementById('exerciseDifficulty');
const equipmentSelect = document.getElementById('exerciseEquipment');
const applyFiltersBtn = document.getElementById('exerciseApplyFiltersBtn');

(function loadSavedExerciseFilters() {
  const saved = JSON.parse(localStorage.getItem("exerciseFilters"));
  if (!saved) return;

  searchInput.value = saved.search || "";
  bodyPartSelect.value = saved.bodyPart || "";
  difficultySelect.value = saved.difficulty || "";
  equipmentSelect.value = saved.equipment || "";
})();

// === read initial filters from URL (?bodyPart=ABS&difficulty=BEGINNER) ===
(function syncFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const bp = params.get('bodyPart');
  const diff = params.get('difficulty');
  const eq = params.get('equipment');

  if (bp) bodyPartSelect.value = bp;
  if (diff) difficultySelect.value = diff;
  if (eq) equipmentSelect.value = eq;
})();

function buildQueryString() {
  const params = new URLSearchParams();

  if (searchInput.value.trim() !== '') {
    params.append('search', searchInput.value.trim());
  }
  if (bodyPartSelect.value) {
    params.append('bodyPart', bodyPartSelect.value);
  }
  if (difficultySelect.value) {
    params.append('difficulty', difficultySelect.value);
  }
  if (equipmentSelect.value) {
    params.append('equipment', equipmentSelect.value);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function fetchExercises() {
  const qs = buildQueryString();

  statusEl.textContent = 'Loading exercises...';
  statusEl.classList.remove('error');

  try {
    const res = await fetch(`/exercises${qs}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const exercises = await res.json();

    statusEl.textContent = `${exercises.length} exercise(s) found.`;

    allExercises = exercises;   // save full list

    const savedFeatured = JSON.parse(localStorage.getItem("selectedFeatured"));

    if (savedFeatured) {
      // Render locked featured exercise
      renderFeatured(savedFeatured);

      // DO NOT return — allow the grid to show all exercises
    } else {
      // Normal mode: random + rotation
      pickRandomFeatured();
      startFeaturedRotation();
    }

    // ALWAYS render the list
    renderExerciseList(exercises);

  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load exercises. Please try again.';
    statusEl.classList.add('error');
    renderFeatured(null);
    renderExerciseList([]);
  }
}

function pickRandomFeatured() {
  if (!allExercises || allExercises.length === 0) {
    renderFeatured(null);
    return;
  }

  featuredEl.classList.add("fade-out");

  setTimeout(() => {
    const randomIndex = Math.floor(Math.random() * allExercises.length);
    const randomExercise = allExercises[randomIndex];

    renderFeatured(randomExercise);

    featuredEl.classList.remove("fade-out");

    // Restart progress bar animation
    animateProgressBar();

  }, 800);
}

function startFeaturedRotation() {
  if (featuredInterval) clearInterval(featuredInterval);

  featuredInterval = setInterval(() => {
    pickRandomFeatured();
  }, 7000); // rotate every 7 seconds
}

function animateProgressBar() {
  const bar = featuredEl.querySelector(".featured-progress-fill");
  if (!bar) return;

  // Reset instantly
  bar.style.transition = "none";
  bar.style.width = "0%";

  // Allow browser to apply reset before animating
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = "width 5s linear";
      bar.style.width = "100%";
    });
  });
}

function renderFeatured(exercise) {
  if (!exercise) {
    featuredEl.classList.add('empty');
    featuredEl.innerHTML = '';
    return;
  }

  featuredEl.classList.remove('empty');

  const imgUrl =
    exercise.imageUrl ||
    'https://images.pexels.com/photos/1552102/pexels-photo-1552102.jpeg';

featuredEl.innerHTML = `
  <div class="exercise-featured-img"
       style="background-image:url('${imgUrl}')"></div>

  <div class="exercise-featured-content">
    <div>
      <h2 class="exercise-featured-title">${exercise.name}</h2>
      <div class="exercise-featured-meta">
        ${exercise.bodyPart} • ${exercise.equipment.replace('_', ' ')} • ${exercise.difficulty}
      </div>
      <p class="exercise-featured-desc">
        ${exercise.shortDesc || 'No description provided yet.'}
      </p>
    </div>
    <div>
      ${
        exercise.videoUrl
          ? `<a class="resource-link" href="${exercise.videoUrl}" target="_blank" rel="noopener noreferrer">
              Watch tutorial
            </a>`
          : ''
      }
    </div>
  </div>

  <!-- Progress bar -->
  <div class="featured-progress">
    <div class="featured-progress-fill"></div>
  </div>
`;

}

function renderExerciseList(exercises) {
  exerciseListEl.innerHTML = '';

  if (!exercises || exercises.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No other exercises match your filters.';
    exerciseListEl.appendChild(p);
    return;
  }

  exercises.forEach((ex) => {
    const card = document.createElement('article');
    card.className = 'exercise-card';

    const title = document.createElement('h3');
    title.className = 'exercise-card-title';
    title.textContent = ex.name;

    const meta = document.createElement('div');
    meta.className = 'exercise-card-meta';
    meta.textContent = `${ex.bodyPart} • ${ex.equipment.replace(
      '_',
      ' '
    )} • ${ex.difficulty}`;

    const desc = document.createElement('p');
    desc.className = 'exercise-card-desc';
    desc.textContent =
      ex.shortDesc ||
      'No description yet. This exercise will be updated soon.';

    const tags = document.createElement('div');

    const bodyTag = document.createElement('span');
    bodyTag.className = 'exercise-tag exercise-tag-body';
    bodyTag.textContent = ex.bodyPart;
    tags.appendChild(bodyTag);

    const diffTag = document.createElement('span');
    diffTag.className = 'exercise-tag exercise-tag-diff';
    diffTag.textContent = ex.difficulty;
    tags.appendChild(diffTag);

    const eqTag = document.createElement('span');
    eqTag.className = 'exercise-tag exercise-tag-equip';
    eqTag.textContent = ex.equipment.replace('_', ' ');
    tags.appendChild(eqTag);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(tags);

    // === NEW: When user clicks a card, freeze rotation and save selection ===
    card.addEventListener("click", () => {
      // Stop the auto-rotation
      if (featuredInterval) clearInterval(featuredInterval);

      // Render this exercise as the featured one
      renderFeatured(ex);

      // Save as "locked" featured exercise
      localStorage.setItem("selectedFeatured", JSON.stringify(ex));

      // Also update status text (optional, but nice UX)
      statusEl.textContent = `Featured exercise locked: ${ex.name}`;
    });

    // Append to grid
    exerciseListEl.appendChild(card);
  });
}

(function handleCrossPageState() {
  const cameFromResources = localStorage.getItem("fromResourcesPage");
  if (!cameFromResources) return;

  // Example: auto-apply BEGINNER difficulty as default
  if (!difficultySelect.value) {
    difficultySelect.value = "BEGINNER";
  }

  localStorage.removeItem("fromResourcesPage");
})();

// events
applyFiltersBtn.addEventListener('click', (e) => {
  e.preventDefault();
  fetchExercises();
});

const resetBtn = document.getElementById("exerciseResetFiltersBtn");

resetBtn.addEventListener("click", () => {
  // 1. Clear all filter inputs
  searchInput.value = "";
  bodyPartSelect.value = "";
  difficultySelect.value = "";
  equipmentSelect.value = "";

  // 2. Clear localStorage filter state
  localStorage.removeItem("exerciseFilters");
  localStorage.removeItem("selectedFeatured");
  localStorage.removeItem("fromResourcesPage");

  // 3. Clear URL parameters (reload clean)
  const cleanUrl = window.location.origin + window.location.pathname;
  window.location.href = cleanUrl;
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    fetchExercises();
    localStorage.setItem("exerciseFilters", JSON.stringify({
    search: searchInput.value.trim(),
    bodyPart: bodyPartSelect.value,
    difficulty: difficultySelect.value,
    equipment: equipmentSelect.value,
}));
  }
});

// initial load
fetchExercises();