document.addEventListener('DOMContentLoaded', () => {
  // --- Workouts info for favourite ---
  const workouts = JSON.parse(localStorage.getItem('wt_workouts') || '[]');

  const favNameEl = document.getElementById('dashFavWorkout');
  const favMetaEl = document.getElementById('dashFavWorkoutMeta');

  if (!workouts.length) {
    favNameEl.textContent = '–';
    favMetaEl.textContent = 'No workouts yet. Add one from the Workouts page.';
  } else {
    let favourite = null;
    workouts.forEach(w => {
      if (!favourite || (w.upvotes || 0) > (favourite.upvotes || 0)) {
        favourite = w;
      }
    });

    if (favourite && (favourite.upvotes || 0) > 0) {
      favNameEl.textContent = favourite.name;
      favMetaEl.textContent = `${favourite.upvotes || 0} upvote${
        (favourite.upvotes || 0) === 1 ? '' : 's'
      } · ${favourite.muscleGroup}`;
    } else {
      favNameEl.textContent = '–';
      favMetaEl.textContent = 'No upvotes yet.';
    }
  }

  // --- Plans info: active days and previous preset ---
  const weekPlan = JSON.parse(localStorage.getItem('wt_week_plan') || 'null');
  const presets = JSON.parse(localStorage.getItem('wt_plan_presets') || '[]');

  const activeDaysCountEl = document.getElementById('dashActiveDaysCount');
  const activeDaysMetaEl = document.getElementById('dashActiveDaysMeta');
  const prevPresetEl = document.getElementById('dashPreviousPreset');
  const prevPresetMetaEl = document.getElementById('dashPreviousPresetMeta');

  if (!weekPlan || !weekPlan.days) {
    activeDaysCountEl.textContent = '0';
    activeDaysMetaEl.textContent = 'No weekly plan yet.';
  } else {
    const days = Object.values(weekPlan.days);
    const activeDays = days.filter(d => d && d.active).length;
    activeDaysCountEl.textContent = activeDays;
    activeDaysMetaEl.textContent =
      activeDays === 0
        ? 'Mark days active in the Plans page.'
        : `${activeDays} day${activeDays === 1 ? '' : 's'} marked as active.`;
  }

  const prevPresetId = weekPlan?.previousPresetId || null;
  if (!prevPresetId) {
    prevPresetEl.textContent = '–';
    prevPresetMetaEl.textContent =
      'When you swap presets for a day, the previous one appears here.';
  } else {
    const preset = presets.find(p => p.id === prevPresetId);
    if (!preset) {
      prevPresetEl.textContent = '–';
      prevPresetMetaEl.textContent =
        'Last preset reference not found. It may have been deleted.';
    } else {
      prevPresetEl.textContent = preset.name;
      prevPresetMetaEl.textContent = 'Previously used preset for a day.';
    }
  }
});
