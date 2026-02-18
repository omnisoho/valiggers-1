// ==========================================
// STATE
// ==========================================

let userRewards = {
  totalPoints: 0,
  redeemptions: [],
};

let currentRedeemingReward = null;

// ==========================================
// REWARD DEFINITIONS
// ==========================================

const REWARDS = {
  'voucher-10': {
    icon: '🛍️',
    name: '$10 Store Voucher',
    cost: 500,
    description: 'Get $10 off your next store purchase',
  },
  'unlock-challenge': {
    icon: '🎯',
    name: 'Extra Challenge Unlock',
    cost: 250,
    description: 'Unlock bonus challenges to complete',
  },
  'badge-power': {
    icon: '⭐',
    name: 'Power User Badge',
    cost: 1000,
    description: 'Exclusive badge for elite users',
  },
};

const POINT_VALUES = {
  CHALLENGE_COMPLETED: 100,
  WORKOUT_UPVOTE: 10,
  COMMENT_ADDED: 5,
};

// ==========================================
// API CALLS
// ==========================================

async function fetchUserRewards() {
  try {
    const response = await fetch('/rewards-api/user', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    if (!response.ok) throw new Error('Failed to fetch rewards');
    return await response.json();
  } catch (err) {
    console.error('Error fetching rewards:', err);
    // Fallback: get from localStorage
    return {
      totalPoints: parseInt(localStorage.getItem('userPoints') || '0', 10),
      redeemptions: JSON.parse(localStorage.getItem('userRedeemptions') || '[]'),
    };
  }
}

async function redeemReward(rewardId) {
  try {
    const response = await fetch('/rewards-api/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ rewardId }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to redeem reward');
    }
    return await response.json();
  } catch (err) {
    alert(`Error: ${err.message}`);
    throw err;
  }
}

// ==========================================
// LOCAL REWARD TRACKING
// ==========================================

function saveUserPoints(points) {
  localStorage.setItem('userPoints', String(points));
}

function saveRedeemptions(redeemptions) {
  localStorage.setItem('userRedeemptions', JSON.stringify(redeemptions));
}

function addRedeemption(rewardId) {
  const now = new Date();
  const redeemption = {
    id: Date.now(),
    rewardId,
    rewardName: REWARDS[rewardId]?.name || rewardId,
    pointsCost: REWARDS[rewardId]?.cost || 0,
    redeemedAt: now.toISOString(),
  };
  userRewards.redeemptions.unshift(redeemption);
  saveRedeemptions(userRewards.redeemptions);
  return redeemption;
}

// ==========================================
// RENDERING
// ==========================================

function renderPointsDisplay() {
  const totalPoints = userRewards.totalPoints;
  const nextMilestone = 500;
  const percent = Math.min((totalPoints / nextMilestone) * 100, 100);

  document.getElementById('totalPointsDisplay').textContent = totalPoints.toLocaleString();
  document.getElementById('nextMilestoneDisplay').textContent = `${Math.round(percent)}%`;
  document.getElementById('progressBar').style.width = `${percent}%`;
  document.getElementById('milestoneDetail').textContent = `${totalPoints} / 500`;

  const vouchers = userRewards.redeemptions.filter(r => r.rewardId === 'voucher-10').length;
  document.getElementById('vouchersCountDisplay').textContent = vouchers;

  // Update button states
  Object.keys(REWARDS).forEach(rewardId => {
    const btn = document.getElementById(`redeemBtn-${rewardId}`);
    if (btn) {
      const reward = REWARDS[rewardId];
      if (totalPoints >= reward.cost) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.disabled = false;
      } else {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.disabled = true;
      }
    }
  });
}

function renderRedemptionHistory() {
  const container = document.getElementById('redemptionHistoryContainer');
  const noState = document.getElementById('noHistoryState');

  if (!userRewards.redeemptions || userRewards.redeemptions.length === 0) {
    noState.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  noState.style.display = 'none';

  container.innerHTML = userRewards.redeemptions
    .map((redemption) => {
      const date = new Date(redemption.redeemedAt);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
      <div style="padding: 12px; background: var(--bg-elevated); border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; color: var(--text);">${escapeHtml(redemption.rewardName)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${dateStr}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: var(--accent);">-${redemption.pointsCost}</div>
          <div style="font-size: 11px; color: var(--text-muted);">points</div>
        </div>
      </div>
    `;
    })
    .join('');
}

// ==========================================
// EVENT HANDLERS
// ==========================================

function onOpenRedeemModal(e) {
  const rewardId = e.target.dataset.rewardId;
  const reward = REWARDS[rewardId];

  if (!reward) return;

  currentRedeemingReward = rewardId;

  document.getElementById('redeemModalSubtitle').textContent = `Costs ${reward.cost} points`;
  document.getElementById('redeemRewardIcon').textContent = reward.icon;
  document.getElementById('redeemRewardName').textContent = reward.name;
  document.getElementById('redeemRewardCost').textContent = reward.description;
  document.getElementById('redeemCurrentPoints').textContent = userRewards.totalPoints.toLocaleString();

  document.getElementById('redeemModal').classList.add('active');
}

function onCloseRedeemModal() {
  document.getElementById('redeemModal').classList.remove('active');
}

async function onConfirmRedeem() {
  if (!currentRedeemingReward) return;

  const reward = REWARDS[currentRedeemingReward];
  if (!reward || userRewards.totalPoints < reward.cost) {
    alert('Not enough points!');
    return;
  }

  try {
    // Try to redeem via API
    await redeemReward(currentRedeemingReward);

    // Update local state
    userRewards.totalPoints -= reward.cost;
    addRedeemption(currentRedeemingReward);
    saveUserPoints(userRewards.totalPoints);

    alert(`✅ Successfully redeemed: ${reward.name}`);
    onCloseRedeemModal();
    renderPointsDisplay();
    renderRedemptionHistory();
  } catch (err) {
    // Error already shown by alert
  }
}

// ==========================================
// LOADING
// ==========================================

async function loadUserRewards() {
  userRewards = await fetchUserRewards();
  renderPointsDisplay();
  renderRedemptionHistory();
}

// ==========================================
// INIT
// ==========================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = './login.html';
  }
}

function setupEventListeners() {
  // Redeem buttons
  document.querySelectorAll('.btn-link-redeem').forEach((btn) => {
    btn.addEventListener('click', onOpenRedeemModal);
  });

  // Modal buttons
  document.getElementById('redeemCloseBtn')?.addEventListener('click', onCloseRedeemModal);
  document.getElementById('redeemCancelBtn')?.addEventListener('click', onCloseRedeemModal);
  document.getElementById('redeemConfirmBtn')?.addEventListener('click', onConfirmRedeem);

  // Close modal on backdrop click
  document.getElementById('redeemModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'redeemModal') onCloseRedeemModal();
  });

  // Brand home button
  document.getElementById('brandHomeButton')?.addEventListener('click', () => {
    window.location.href = '/workout';
  });
}

async function init() {
  checkAuth();
  setupEventListeners();
  await loadUserRewards();
}

init();
