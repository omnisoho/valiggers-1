document.addEventListener('DOMContentLoaded', () => {
  // THEME
  const THEME_KEY = 'wt_theme';
  const root = document.documentElement;
  const body = document.body;
  const toggleBtn = document.getElementById('themeToggle');

  function applyTheme(theme) {
    if (theme === 'light') {
      body.classList.add('theme-light');
    } else {
      body.classList.remove('theme-light');
    }
  }

  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = localStorage.getItem(THEME_KEY) || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      toggleBtn.querySelector('.theme-label').textContent =
        next === 'dark' ? 'Dark' : 'Light';
    });

    toggleBtn.querySelector('.theme-label').textContent =
      savedTheme === 'dark' ? 'Dark' : 'Light';
  }

  // FADE-IN
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // NAV ACTIVE STATE
  const path = window.location.pathname;
  document.querySelectorAll('[data-nav]').forEach(link => {
    const target = link.getAttribute('href');
    if (target === path) {
      link.classList.add('active');
    }
    if (path === '/' && target === '/workout') {
      link.classList.add('active');
    }
  });
});
