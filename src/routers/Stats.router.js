const express = require('express');
const router = express.Router();
const prisma = require('../models/prismaClient');
const jwt = require('jsonwebtoken');

// GET /stats-api
// Public endpoint; uses JWT only if present for personal stats
router.get('/', async (req, res, next) => {
  try {
    // ---------- OPTIONAL USER (for personal stats) ----------
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        userId = payload.userId;
      } catch (err) {
        // invalid/expired token → just ignore, treat as not logged in
        userId = null;
      }
    }

    // ---------- GLOBAL STATS QUERIES ----------
    const [
      totalWorkouts,
      totalComments,
      mostUpvoted,
      mostDownvoted,
      mostCommentedArr,
      allWorkouts,
      muscleGroupCounts,
      muscleUpvotes,
      muscleDifficulty,
    ] = await Promise.all([
      // Total workouts in system
      prisma.workout.count(),

      // Total comments
      prisma.comment.count(),

      // Most upvoted workout
      prisma.workout.findFirst({
        orderBy: { upvotes: 'desc' },
        where: { upvotes: { gt: 0 } },
        select: {
          id: true,
          name: true,
          upvotes: true,
          muscleGroup: true,
          difficulty: true,
        },
      }),

      // Most downvoted workout
      prisma.workout.findFirst({
        orderBy: { downvotes: 'desc' },
        where: { downvotes: { gt: 0 } },
        select: {
          id: true,
          name: true,
          downvotes: true,
          muscleGroup: true,
          difficulty: true,
        },
      }),

      // Most commented workout (by relation count)
      prisma.workout.findMany({
        include: {
          _count: {
            select: { comments: true },
          },
        },
        orderBy: {
          comments: {
            _count: 'desc',
          },
        },
        take: 1,
      }),

      // All workouts (for “most controversial” calculation)
      prisma.workout.findMany({
        select: {
          id: true,
          name: true,
          upvotes: true,
          downvotes: true,
        },
      }),

      // Count of workouts per muscle group
      prisma.workout.groupBy({
        by: ['muscleGroup'],
        _count: { muscleGroup: true },
      }),

      // Total upvotes per muscle group
      prisma.workout.groupBy({
        by: ['muscleGroup'],
        _sum: { upvotes: true },
      }),

      // Average difficulty per muscle group
      prisma.workout.groupBy({
        by: ['muscleGroup'],
        _avg: { difficulty: true },
      }),
    ]);

    // Format “most commented”
    const mostCommentedRaw = mostCommentedArr[0];
    const mostCommented = mostCommentedRaw
      ? {
          id: mostCommentedRaw.id,
          name: mostCommentedRaw.name,
          commentCount: mostCommentedRaw._count.comments,
        }
      : null;

    // Compute “most controversial” = biggest |upvotes - downvotes|
    let mostControversial = null;
    allWorkouts.forEach((w) => {
      const score = Math.abs((w.upvotes || 0) - (w.downvotes || 0));
      if (!mostControversial || score > mostControversial.score) {
        mostControversial = {
          id: w.id,
          name: w.name,
          score,
        };
      }
    });
    if (mostControversial && mostControversial.score === 0) {
      mostControversial = null;
    }

    // Format muscle stats
    const muscleGroupCountsFormatted = muscleGroupCounts.map((g) => ({
      muscleGroup: g.muscleGroup,
      count: g._count.muscleGroup,
    }));

    const muscleUpvotesFormatted = muscleUpvotes.map((g) => ({
      muscleGroup: g.muscleGroup,
      totalUpvotes: g._sum.upvotes || 0,
    }));

    const muscleDifficultyFormatted = muscleDifficulty.map((g) => ({
      muscleGroup: g.muscleGroup,
      avgDifficulty: g._avg.difficulty || 0,
    }));

    // ---------- PERSONAL STATS (if logged in) ----------
    let userStats = null;

    if (userId) {
      const [
        userWorkoutCount,
        userPresetCount,
        userPresetItemGroups,
        weeklyPlan,
      ] = await Promise.all([
        prisma.workout.count({ where: { createdById: userId } }),
        prisma.preset.count({ where: { userId } }),
        prisma.presetItem.groupBy({
          by: ['presetId'],
          _count: { id: true },
          where: {
            preset: {
              userId,
            },
          },
        }),
        prisma.weeklyPlan.findUnique({
          where: { userId },
          select: {
            mondayId: true,
            tuesdayId: true,
            wednesdayId: true,
            thursdayId: true,
            fridayId: true,
            saturdayId: true,
            sundayId: true,
          },
        }),
      ]);

      let totalItems = 0;
      userPresetItemGroups.forEach((g) => {
        totalItems += g._count.id;
      });

      const avgPresetSize =
        userPresetItemGroups.length > 0
          ? totalItems / userPresetItemGroups.length
          : 0;

      let assignedDays = 0;
      let emptyDays = 0;

      if (weeklyPlan) {
        const dayIds = [
          weeklyPlan.mondayId,
          weeklyPlan.tuesdayId,
          weeklyPlan.wednesdayId,
          weeklyPlan.thursdayId,
          weeklyPlan.fridayId,
          weeklyPlan.saturdayId,
          weeklyPlan.sundayId,
        ];
        assignedDays = dayIds.filter((id) => id != null).length;
        emptyDays = 7 - assignedDays;
      }

      userStats = {
        userId,
        totalUserWorkouts: userWorkoutCount,
        totalUserPresets: userPresetCount,
        avgPresetSize,
        weeklyPlan: weeklyPlan
          ? { assignedDays, emptyDays }
          : { assignedDays: 0, emptyDays: 7 },
      };
    }

    // ---------- FINAL RESPONSE ----------
    res.json({
      global: {
        totalWorkouts,
        totalComments,
        mostUpvoted,
        mostDownvoted,
        mostCommented,
        mostControversial,
        muscleGroupCounts: muscleGroupCountsFormatted,
        muscleUpvotes: muscleUpvotesFormatted,
        muscleDifficulty: muscleDifficultyFormatted,
      },
      user: userStats, // null if not logged in / invalid token
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
