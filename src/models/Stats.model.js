// models/Stats.model.js
const prisma = require("./prismaClient");

module.exports.getUserStats = async function (userId) {
  const [
    totalWorkouts,
    totalComments,
    mostUpvoted,
    groupedMuscles,
    userPresets,
    weeklyPlan
  ] = await Promise.all([
    prisma.workout.count({ where: { createdById: userId } }),

    prisma.comment.count({ where: { userId: userId } }),

    prisma.workout.findFirst({
      where: { createdById: userId },
      orderBy: { upvotes: "desc" }
    }),

    prisma.workout.groupBy({
      by: ["muscleGroup"],
      _count: { muscleGroup: true },
      where: { createdById: userId }
    }),

    prisma.preset.findMany({
      where: { userId },
      include: { items: true }
    }),

    prisma.weeklyPlan.findUnique({
      where: { userId },
      include: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true
      }
    })
  ]);

  return {
    totalWorkouts,
    totalComments,
    mostUpvoted,
    muscleGroupCounts: groupedMuscles,
    presets: userPresets,
    weeklyPlan
  };
};
