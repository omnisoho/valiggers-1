const prisma = require("./prismaClient");

module.exports.getWeeklyPlan = function getWeeklyPlan(userId) {
  return prisma.weeklyPlan.findUnique({
    where: { userId },
    include: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    }
  });
};

// Create empty weekly plan (first time user)
module.exports.createEmptyWeeklyPlan = function createEmptyWeeklyPlan(userId) {
  return prisma.weeklyPlan.create({
    data: { userId }
  });
};

// Update a single day → e.g. day="monday", presetId = 3
module.exports.updateDay = function updateDay(userId, day, presetId) {
  return prisma.weeklyPlan.update({
    where: { userId },
    data: { [`${day}Id`]: presetId }
  });
};

// Reset entire plan to NULL
module.exports.reset = function reset(userId) {
  return prisma.weeklyPlan.update({
    where: { userId },
    data: {
      mondayId: null,
      tuesdayId: null,
      wednesdayId: null,
      thursdayId: null,
      fridayId: null,
      saturdayId: null,
      sundayId: null,
    }
  });
};
