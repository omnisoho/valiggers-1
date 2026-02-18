const prisma = require('./prismaClient');

// ==========================================
// CHALLENGE CATALOG (public)
// ==========================================

module.exports.getActiveChallenges = async function getActiveChallenges() {
  return prisma.challenge.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
};

module.exports.getChallengeById = async function getChallengeById(id) {
  return prisma.challenge.findUnique({
    where: { id: Number(id) },
  });
};

// ==========================================
// USER CHALLENGES (private)
// ==========================================

module.exports.getUserChallenges = async function getUserChallenges(userId) {
  return prisma.userChallenge.findMany({
    where: { userId: Number(userId) },
    include: {
      challenge: true,
    },
    orderBy: { acceptedAt: 'desc' },
  });
};

module.exports.getUserChallengeById = async function getUserChallengeById(userChallengeId) {
  return prisma.userChallenge.findUnique({
    where: { id: Number(userChallengeId) },
    include: {
      challenge: true,
    },
  });
};

module.exports.getUserChallengesByStatus = async function getUserChallengesByStatus(
  userId,
  status
) {
  return prisma.userChallenge.findMany({
    where: {
      userId: Number(userId),
      status,
    },
    include: {
      challenge: true,
    },
    orderBy: { acceptedAt: 'desc' },
  });
};

// ==========================================
// ACCEPT CHALLENGE
// ==========================================

module.exports.acceptChallenge = async function acceptChallenge(userId, challengeId) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: Number(challengeId) },
  });

  if (!challenge) {
    throw new Error('Challenge not found');
  }

  // Check if already accepted
  const existing = await prisma.userChallenge.findUnique({
    where: {
      userId_challengeId: {
        userId: Number(userId),
        challengeId: Number(challengeId),
      },
    },
  });

  if (existing) {
    throw new Error('Already accepted');
  }

  // Create new UserChallenge
  return prisma.userChallenge.create({
    data: {
      userId: Number(userId),
      challengeId: Number(challengeId),
      status: 'ACCEPTED',
      progressValue: 0,
    },
    include: {
      challenge: true,
    },
  });
};

// ==========================================
// UPDATE STATUS
// ==========================================

module.exports.updateUserChallengeStatus = async function updateUserChallengeStatus(
  userChallengeId,
  newStatus
) {
  const validStatuses = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const data = { status: newStatus };

  // Set completedAt if moving to COMPLETED
  if (newStatus === 'COMPLETED') {
    data.completedAt = new Date();
  }

  // Get previous state to avoid double-awarding points
  const previous = await prisma.userChallenge.findUnique({
    where: { id: Number(userChallengeId) },
    include: { challenge: true },
  });

  const updated = await prisma.userChallenge.update({
    where: { id: Number(userChallengeId) },
    data,
    include: {
      challenge: true,
    },
  });

  // Award points on first-time completion
  if (newStatus === 'COMPLETED' && previous && previous.status !== 'COMPLETED') {
    const points = updated.challenge?.pointsReward || 0;
    if (points > 0) {
      await prisma.userRewards.upsert({
        where: { userId: previous.userId },
        create: { userId: previous.userId, totalPoints: points },
        update: { totalPoints: { increment: points } },
      });
    }
  }

  return updated;
};

// ==========================================
// UPDATE PROGRESS with AUTO-COMPLETE
// ==========================================

module.exports.updateUserChallengeProgress = async function updateUserChallengeProgress(
  userChallengeId,
  progressDelta = 1
) {
  const userChallenge = await prisma.userChallenge.findUnique({
    where: { id: Number(userChallengeId) },
    include: { challenge: true },
  });

  if (!userChallenge) {
    throw new Error('UserChallenge not found');
  }

  const newProgress = userChallenge.progressValue + progressDelta;
  const targetValue = userChallenge.challenge.targetValue;

  // Determine new status
  let newStatus = userChallenge.status;
  let completedAt = userChallenge.completedAt;

  if (newProgress >= targetValue) {
    newStatus = 'COMPLETED';
    completedAt = new Date();
  }

  const updated = await prisma.userChallenge.update({
    where: { id: Number(userChallengeId) },
    data: {
      progressValue: newProgress,
      status: newStatus,
      completedAt,
    },
    include: {
      challenge: true,
    },
  });

  // Award points if just completed
  if (newStatus === 'COMPLETED' && userChallenge.status !== 'COMPLETED') {
    const points = updated.challenge?.pointsReward || 0;
    if (points > 0) {
      await prisma.userRewards.upsert({
        where: { userId: userChallenge.userId },
        create: { userId: userChallenge.userId, totalPoints: points },
        update: { totalPoints: { increment: points } },
      });
    }
  }

  return updated;
};

// ==========================================
// DELETE USER CHALLENGE
// ==========================================

module.exports.deleteUserChallenge = async function deleteUserChallenge(userChallengeId) {
  return prisma.userChallenge.delete({
    where: { id: Number(userChallengeId) },
  });
};

//
// ======================================================
// SINGLE DAILY CHALLENGE (Complete 1 Session) - AVAILABLE -> ACCEPTED -> IN_PROGRESS -> COMPLETED
// ======================================================

// Singapore day boundary helper (UTC+8)
function startOfTodaySG(now = new Date()) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + offsetMs);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMs);
}

const SINGLE_CHALLENGE = {
  title: "Complete 1 Session",
  description: "Finish one workout session today.",
  type: "COUNT",
  targetValue: 1,
  pointsReward: 50,
  isActive: true,
};

async function ensureSingleChallengeExists() {
  const existing = await prisma.challenge.findFirst({
    where: { title: SINGLE_CHALLENGE.title },
    orderBy: { id: "asc" },
  });

  if (existing) return existing;

  return prisma.challenge.create({ data: SINGLE_CHALLENGE });
}

// Internal: compute yesterday status from a UserChallenge row (if it belongs to a previous day),
// then reset it to AVAILABLE for today.
async function maybeRolloverDailyChallenge(uc) {
  const todayStart = startOfTodaySG(new Date());

  // If UC is from today (acceptedAt >= todayStart), no rollover
  if (uc.acceptedAt && uc.acceptedAt >= todayStart) {
    return { userChallenge: uc, previousDayStatus: null };
  }

  // Determine previous day status (based on yesterday state)
  let previousDayStatus = "EXPIRED";
  if (uc.status === "COMPLETED") previousDayStatus = "COMPLETED";
  else if (uc.status === "AVAILABLE") previousDayStatus = "EXPIRED";
  else previousDayStatus = "FAILED"; // accepted / in progress but not completed

  // Reset for today
  const reset = await prisma.userChallenge.update({
    where: { id: uc.id },
    data: {
      status: "AVAILABLE",
      progressValue: 0,
      completedAt: null,
      // keep acceptedAt as "today" marker even if it's AVAILABLE
      acceptedAt: todayStart,
    },
    include: { challenge: true },
  });

  return { userChallenge: reset, previousDayStatus };
}

// Returns the user's UserChallenge row for the single daily challenge.
// Ensures it exists and rolls it over to a fresh AVAILABLE challenge each new SG day.
// Also returns the previous day's status (COMPLETED / FAILED / EXPIRED) when rollover happens.
module.exports.getMySingleChallenge = async function getMySingleChallenge(userId) {
  const challenge = await ensureSingleChallengeExists();
  const uid = Number(userId);
  const todayStart = startOfTodaySG(new Date());

  // Upsert (unique on userId+challengeId)
  let userChallenge = await prisma.userChallenge.upsert({
    where: { userId_challengeId: { userId: uid, challengeId: challenge.id } },
    create: {
      userId: uid,
      challengeId: challenge.id,
      status: "AVAILABLE",
      progressValue: 0,
      // Use today's start as a "day marker"
      acceptedAt: todayStart,
    },
    update: {},
    include: { challenge: true },
  });

  const rolled = await maybeRolloverDailyChallenge(userChallenge);
  return rolled;
};

// Accept today's challenge: AVAILABLE -> ACCEPTED (UI can then animate to IN_PROGRESS)
module.exports.acceptMySingleChallenge = async function acceptMySingleChallenge(userId) {
  const { userChallenge } = await module.exports.getMySingleChallenge(userId);
  const todayStart = startOfTodaySG(new Date());

  // Already accepted/in-progress/completed today
  if (userChallenge.acceptedAt >= todayStart && userChallenge.status !== "AVAILABLE") {
    return userChallenge;
  }

  const updated = await prisma.userChallenge.update({
    where: { id: userChallenge.id },
    data: {
      status: "ACCEPTED",
      // mark accept time as now (still today)
      acceptedAt: new Date(),
      progressValue: 0,
      completedAt: null,
    },
    include: { challenge: true },
  });

  return updated;
};

// Start: ACCEPTED -> IN_PROGRESS (optional, for UI/flow)
module.exports.startMySingleChallenge = async function startMySingleChallenge(userId) {
  const { userChallenge } = await module.exports.getMySingleChallenge(userId);

  if (userChallenge.status === "IN_PROGRESS" || userChallenge.status === "COMPLETED") {
    return userChallenge;
  }

  if (userChallenge.status === "AVAILABLE") {
    // must accept first
    throw new Error("Challenge not accepted yet");
  }

  const updated = await prisma.userChallenge.update({
    where: { id: userChallenge.id },
    data: { status: "IN_PROGRESS" },
    include: { challenge: true },
  });

  return updated;
};

// Called when a user completes a session.
// Completes the daily challenge once/day *only if accepted/in-progress* and awards points once/day.
module.exports.onSessionCompleted = async function onSessionCompleted(userId) {
  const todayStart = startOfTodaySG(new Date());
  const { userChallenge } = await module.exports.getMySingleChallenge(userId);

  // Must accept first
  if (userChallenge.status === "AVAILABLE") {
    return { ok: true, ignored: true, reason: "not_accepted" };
  }

  // already completed today -> do nothing
  if (userChallenge.status === "COMPLETED" && userChallenge.completedAt && userChallenge.completedAt >= todayStart) {
    return { ok: true, alreadyCompleted: true };
  }

  // mark completed
  const updated = await prisma.userChallenge.update({
    where: { id: userChallenge.id },
    data: {
      status: "COMPLETED",
      progressValue: userChallenge.challenge?.targetValue ?? 1,
      completedAt: new Date(),
    },
    include: { challenge: true },
  });

  const points = updated.challenge?.pointsReward ?? 0;
  if (points > 0) {
    await prisma.userRewards.upsert({
      where: { userId: Number(userId) },
      create: { userId: Number(userId), totalPoints: points },
      update: { totalPoints: { increment: points } },
    });
  }

  return { ok: true, awarded: points };
};
