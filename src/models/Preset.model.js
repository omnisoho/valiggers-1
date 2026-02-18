const prisma = require("./prismaClient");

// GET all presets for a user
module.exports.getAllPresets = function getAllPresets(userId) {
  return prisma.preset.findMany({
    where: { userId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { workout: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

// GET one preset (and verify owner at router level)
module.exports.getPresetById = function getPresetById(id) {
  return prisma.preset.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { workout: true }
      }
    }
  });
};

// CREATE preset
module.exports.createPreset = function createPreset(data, userId) {
  return prisma.preset.create({
    data: {
      name: data.name,
      totalDuration: data.totalDuration || null,
      difficulty: data.difficulty || null,
      notes: data.notes || "",
      userId,
      items: {
        create: data.items.map(item => ({
          workoutId: item.workoutId || null,
          customName: item.customName || null,
          customSets: item.customSets || null,
          customReps: item.customReps || null,
          customDurationMin: item.customDurationMin || null,
          customNotes: item.customNotes || null,
          order: item.order
        }))
      }
    },
    include: { items: true }
  });
};

// UPDATE preset
module.exports.updatePreset = async function updatePreset(id, data, userId) {

  // 1. GET preset first
  const preset = await prisma.preset.findUnique({ where: { id } });

  if (!preset) throw new Error("Preset not found");
  if (preset.userId !== userId) throw new Error("Not allowed");

  // 2. Delete all existing items
  await prisma.presetItem.deleteMany({
    where: { presetId: id }
  });

  // 3. Update preset
  return prisma.preset.update({
    where: { id },
    data: {
      name: data.name,
      totalDuration: data.totalDuration || null,
      difficulty: data.difficulty || null,
      notes: data.notes || "",
      items: {
        create: data.items.map(item => ({
          workoutId: item.workoutId || null,
          customName: item.customName || null,
          customSets: item.customSets || null,
          customReps: item.customReps || null,
          customDurationMin: item.customDurationMin || null,
          customNotes: item.customNotes || null,
          order: item.order
        }))
      }
    },
    include: { items: true }
  });
};

// DELETE preset
module.exports.deletePreset = async function deletePreset(id, userId) {
  const preset = await prisma.preset.findUnique({ where: { id } });

  if (!preset) throw new Error("Preset not found");
  if (preset.userId !== userId) throw new Error("Not allowed");

  return prisma.$transaction(async (tx) => {
    // 1) If this preset is assigned in the user's WeeklyPlan, unassign ONLY those matching days
    const plan = await tx.weeklyPlan.findUnique({ where: { userId } }); // userId is unique in WeeklyPlan
    if (plan) {
      const data = {};
      const fields = ["mondayId","tuesdayId","wednesdayId","thursdayId","fridayId","saturdayId","sundayId"];
      fields.forEach((f) => {
        if (plan[f] === id) data[f] = null;
      });

      // Only update if something actually matches
      if (Object.keys(data).length > 0) {
        await tx.weeklyPlan.update({ where: { userId }, data });
      }
    }

    // 2) Delete sessions that reference this preset (only if WorkoutSession exists in your Prisma schema)
    // This fixes your "PresetSessions" FK chain when deleting presets.
    await tx.workoutSession.deleteMany({
      where: { userId, sourcePresetId: id },
    });

    // 3) Delete preset items first (fixes FK error: PresetItem_presetId_fkey)
    await tx.presetItem.deleteMany({
      where: { presetId: id },
    });

    // 4) Finally delete preset
    return tx.preset.delete({ where: { id } });
  });
};

