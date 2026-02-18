// models/Rewards.model.js
const prisma = require("./prismaClient");

// Point values (constants only; no DB changes)
const POINT_VALUES = {
  CHALLENGE_COMPLETED: 100,
  WORKOUT_UPVOTE: 10,
  COMMENT_ADDED: 5,
};

// Reward catalog (static; ownership is stored client-side since Prisma must not change)
const REWARD_CATALOG = [
  { id: "voucher-1", name: "$1 Voucher", cost: 50 },
  { id: "voucher-3", name: "$3 Voucher", cost: 150 },
  { id: "voucher-5", name: "$5 Voucher", cost: 250 },
];

// ==========================================
// USER REWARDS
// ==========================================

async function getOrCreateUserRewards(userId) {
  const uid = Number(userId);

  let userRewards = await prisma.userRewards.findUnique({
    where: { userId: uid },
  });

  if (!userRewards) {
    const defaultPoints = process.env.NODE_ENV === "production" ? 0 : 100000; // dev demo points
    userRewards = await prisma.userRewards.create({
      data: {
        userId: uid,
        totalPoints: defaultPoints,
      },
    });
  }

  return userRewards;
}

async function getUserRewards(userId) {
  return getOrCreateUserRewards(userId);
}

// ==========================================
// ADD POINTS
// ==========================================

async function addPoints(userId, amount, reason = "") {
  const uid = Number(userId);
  await getOrCreateUserRewards(uid);

  const inc = Number(amount);

  const updated = await prisma.userRewards.update({
    where: { userId: uid },
    data: { totalPoints: { increment: inc } },
  });

  console.log(
    `[REWARDS] +${inc} points to user ${uid}. Reason: ${reason || "N/A"}. Total: ${
      updated.totalPoints
    }`
  );

  return updated;
}

// ==========================================
// REDEEM REWARD (deduct points)
// ==========================================

async function redeemReward(userId, rewardId) {
  const uid = Number(userId);
  const rid = String(rewardId);

  const reward = REWARD_CATALOG.find((r) => r.id === rid);
  if (!reward) throw new Error("Invalid rewardId");

  const current = await getOrCreateUserRewards(uid);
  if (current.totalPoints < reward.cost) throw new Error("Not enough points");

  const updated = await prisma.userRewards.update({
    where: { userId: uid },
    data: { totalPoints: { decrement: reward.cost } },
  });

  console.log(
    `[REWARDS] User ${uid} redeemed: ${reward.name} (${reward.cost} points). Remaining: ${updated.totalPoints}`
  );

  return {
    rewardId: reward.id,
    rewardName: reward.name,
    pointsCost: reward.cost,
    redeemedAt: new Date(),
    remainingPoints: updated.totalPoints,
  };
}

module.exports = {
  // rewards
  getOrCreateUserRewards,
  getUserRewards,
  addPoints,
  redeemReward,

  // constants/catalog
  POINT_VALUES,
  REWARD_CATALOG,
};