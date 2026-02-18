const apiUrl = '.';

// JWT
const token = localStorage.getItem('token');
if (!token) {
  alert('You must be logged in.');
  throw new Error('No JWT found');
}

const summaryDiv = document.getElementById('summary');
const tableContainer = document.getElementById('tableContainer');
const ctx = document.getElementById('intakeChart').getContext('2d');

let chart; // Chart.js instance

// ----------------------
// Render chart
// ----------------------
function renderChart(labels, dataValues, limitsData, periodType, isNutrient = false, nutrientLabel = '', extraData = []) {

  ctx.canvas.style.display = 'block';

  if (chart) chart.destroy();

  if (periodType === 'pie') {
    ctx.canvas.style.width = '380px';
    ctx.canvas.style.height = '380px';
    ctx.canvas.classList.add('pie-centered');

    const total = dataValues[0];
    const limit = limitsData[0];
    const over = total > limit;

    chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: over ? ['Calorie Limit', 'Excess'] : ['Consumed', 'Remaining'],
        datasets: [{
          data: over ? [limit, total - limit] : [total, limit - total],
          backgroundColor: over ? ['#3b82f6', '#ff3860'] : ['#3b82f6', '#aeaeaeff'],
          borderColor: '#000',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ffffff', font: { size: 22 }, padding: 20 } },
          tooltip: { 
            callbacks: {
              label: ctx => {
                if (!extraData.length) return `${ctx.label}: ${ctx.raw} kcal`;
                const day = extraData[0];
                if (!over) {
                  // Normal case: show total calories + nutrients
                  return [
                    `Total Calories: ${day.totalCalories ?? 0}`,
                    `Fat: ${day.totalFat ?? 0}`,
                    `Protein: ${day.totalProtein ?? 0}`,
                    `Sugar: ${day.totalSugar ?? 0}`
                  ];
                } else {
                  // Over calorie limit
                  if (ctx.dataIndex === 0) {
                    // "Calorie Limit" slice
                    return [
                      `Total Calories: ${day.totalCalories ?? 0}`,
                      `Fat: ${day.totalFat ?? 0}`,
                      `Protein: ${day.totalProtein ?? 0}`,
                      `Sugar: ${day.totalSugar ?? 0}`
                    ];
                  } else {
                    // "Excess" slice
                    return [
                      `Calories exceeded: ${day.totalCalories - day.calorieLimit}`,
                      `Fat: ${day.totalFat ?? 0}`,
                      `Protein: ${day.totalProtein ?? 0}`,
                      `Sugar: ${day.totalSugar ?? 0}`
                    ];
                  }
                }
              }
            }
          }
        },
        layout: { padding: { top: 20, bottom: 50 } },
        animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
        radius: '105%'
      }
    });

    summaryDiv.className = over ? 'over' : '';
    summaryDiv.innerHTML = over
      ? `⚠ Total Calories (<span style="color:white;">${total}</span>) exceed limit (<span style="color:white;">${limit}</span>)!`
      : `Total Calories: <span style="color:white;">${total}</span> / Limit: <span style="color:white;">${limit}</span>`;

  } else {
    // BAR CHART (unchanged)
    ctx.canvas.style.width = '';
    ctx.canvas.style.height = '';
    ctx.canvas.classList.remove('pie-centered');

    const barThickness = labels.length <= 15 ? 50 : undefined;
    const barPercentage = labels.length > 15 ? 0.8 : 0.6;
    const categoryPercentage = labels.length > 15 ? 0.8 : 0.6;

    const datasets = isNutrient
      ? [{ label: nutrientLabel, data: dataValues, backgroundColor: '#3b82f6', borderRadius: 10, barThickness }]
      : [
          { label: 'Calorie Limit', data: limitsData, backgroundColor: '#3b82f6', borderRadius: 10, barThickness },
          { label: 'Total Calories', data: dataValues, backgroundColor: '#ff3860', borderRadius: 10, barThickness }
        ];

    chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animations: { y: { duration: 1200, easing: 'easeOutQuart', from: 0 } },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ffffff', font: { size: 20 } } },
          tooltip: { 
            callbacks: {
              label: function(ctx) {
                if (!isNutrient && extraData.length && ctx.dataset.label === 'Total Calories') {
                  const day = extraData[ctx.dataIndex];
                  return [
                    `Calories: ${ctx.raw}`,
                    `Fat: ${day.totalFat ?? 0}`,
                    `Protein: ${day.totalProtein ?? 0}`,
                    `Sugar: ${day.totalSugar ?? 0}`
                  ];
                }
                return `${ctx.dataset.label}: ${ctx.raw}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#ffffff', font: { size: labels.length > 15 ? 12 : 14 } }, grid: { color: 'rgba(255,255,255,0.1)' }, barPercentage, categoryPercentage },
          y: { min: 0, ticks: { color: '#ffffff', font: { size: 20 } }, grid: { color: 'rgba(255,255,255,0.1)' } }
        }
      }
    });

    if (!isNutrient) {
      const overDays = dataValues.map((c, i) => c > limitsData[i] ? i : -1).filter(i => i !== -1);
      summaryDiv.className = overDays.length > 0 ? 'over' : '';
      summaryDiv.innerHTML = overDays.length > 0 ? `⚠ Some days exceeded calorie limit!` : '';
    } else {
      summaryDiv.className = '';
      summaryDiv.innerHTML = '';
    }
  }
}

// ----------------------
// Fetch intake (calories)
// ----------------------
function fetchIntake(period) {

  summaryDiv.textContent = '';
  tableContainer.innerHTML = '';
  if (chart) { chart.destroy(); chart = null; }
  ctx.canvas.style.display = 'none';

  fetch(`${apiUrl}/nutrition/intake?period=${encodeURIComponent(period)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {

      if (!data || (Array.isArray(data) && data.length === 0)) {
        summaryDiv.textContent = 'No data available.';
        ctx.canvas.style.display = 'none';
        return;
      }

      if (Array.isArray(data)) data.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (period === 'today' || period === 'yesterday') {
        const entry = Array.isArray(data) ? data[0] : data;
        ctx.canvas.style.display = 'block';
        renderChart([period], [entry.totalCalories ?? 0], [entry.calorieLimit ?? 2000], 'pie', false, '', [entry]);
        return;
      }

      const labels = data.map(d => new Date(d.date).toLocaleDateString());
      const totalCaloriesArr = data.map(d => d.totalCalories ?? 0);
      const limitArr = data.map(d => d.calorieLimit ?? 2000);

      ctx.canvas.style.display = 'block';
      renderChart(labels, totalCaloriesArr, limitArr, 'bar', false, '', data);

      let html = `<table><thead><tr><th>Date</th><th>Total Calories</th><th>Calorie Limit</th></tr></thead><tbody>`;
      data.forEach(d => {
        const over = d.totalCalories > d.calorieLimit;
        html += `<tr>
          <td>${new Date(d.date).toLocaleDateString()}</td>
          <td class="${over ? 'over' : ''}">${d.totalCalories}</td>
          <td>${d.calorieLimit}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      tableContainer.innerHTML = html;
    })
    .catch(err => { console.error(err); summaryDiv.textContent = 'Error loading data.'; ctx.canvas.style.display = 'none'; });
}

// ----------------------
// Fetch nutrient data
// ----------------------
function fetchNutrientData(nutrient) {

  summaryDiv.textContent = '';
  tableContainer.innerHTML = '';
  if (chart) { chart.destroy(); chart = null; }
  ctx.canvas.style.display = 'none';

  const nutrientFieldMap = {
    fats: 'totalFat',
    protein: 'totalProtein',
    sugar: 'totalSugar'
  };

  const fieldName = nutrientFieldMap[nutrient];
  if (!fieldName) {
    console.error('Invalid nutrient:', nutrient);
    return;
  }

  fetch(`${apiUrl}/nutrition/intake?period=monthly`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        summaryDiv.textContent = 'No data available.';
        return;
      }

      data.sort((a, b) => new Date(b.date) - new Date(a.date));

      const labels = data.map(d => new Date(d.date).toLocaleDateString());
      const nutrientData = data.map(d => d[fieldName] ?? 0);

      ctx.canvas.style.display = 'block';

      renderChart(labels, nutrientData, [], 'bar', true, nutrient.charAt(0).toUpperCase() + nutrient.slice(1));

      let html = `<table><thead><tr><th>Date</th><th>${nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}</th></tr></thead><tbody>`;
      data.forEach(d => {
        html += `<tr><td>${new Date(d.date).toLocaleDateString()}</td><td>${d[fieldName] ?? 0}</td></tr>`;
      });
      html += '</tbody></table>';
      tableContainer.innerHTML = html;
    })
    .catch(err => { 
      console.error(err); 
      summaryDiv.textContent = 'Error loading data.'; 
    });
}

// ----------------------
// Buttons
// ----------------------
document.querySelectorAll('.custom-input button').forEach(btn => {
  if (btn.dataset.period) {
    btn.addEventListener('click', () => fetchIntake(btn.dataset.period));
  } else if (btn.dataset.nutrient) {
    btn.addEventListener('click', () => fetchNutrientData(btn.dataset.nutrient));
  }
});

// Load today's intake by default
fetchIntake('today');
