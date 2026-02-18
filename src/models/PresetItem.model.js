const prisma = require("./prismaClient");

module.exports = {
  addItem(presetId, data) {
    return prisma.presetItem.create({
      data: {
        presetId,
        order: data.order,
        workoutId: data.workoutId || null,
        customName: data.customName || null,
        customSets: data.customSets || null,
        customReps: data.customReps || null,
        customDurationMin: data.customDurationMin || null,
        customNotes: data.customNotes || null
      }
    });
  },

  deleteItemsForPreset(presetId) {
    return prisma.presetItem.deleteMany({ where: { presetId } });
  }
};
