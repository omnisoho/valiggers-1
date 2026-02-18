const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function buildExerciseWhere(filters = {}) {
  const where = {};
  const { search, bodyPart, difficulty, equipment } = filters;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { shortDesc: { contains: search, mode: 'insensitive' } },
      { longDesc: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (bodyPart) {
    where.bodyPart = bodyPart; // e.g. "ABS"
  }

  if (difficulty) {
    where.difficulty = difficulty; // BEGINNER / INTERMEDIATE / ADVANCED
  }

  if (equipment) {
    where.equipment = equipment; // NONE / DUMBBELLS / ...
  }

  return where;
}

async function getAllExercises(filters) {
  const where = buildExerciseWhere(filters);

  return prisma.exercise.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

async function getExerciseById(id) {
  return prisma.exercise.findUnique({
    where: { id: Number(id) },
  });
}

async function createExercise(data) {
  return prisma.exercise.create({
    data: {
      name: data.name,
      slug: data.slug,
      shortDesc: data.shortDesc,
      longDesc: data.longDesc,
      bodyPart: data.bodyPart,
      equipment: data.equipment,
      difficulty: data.difficulty,
      imageUrl: data.imageUrl,
      videoUrl: data.videoUrl,
    },
  });
}

async function updateExercise(id, data) {
  return prisma.exercise.update({
    where: { id: Number(id) },
    data: {
      name: data.name,
      slug: data.slug,
      shortDesc: data.shortDesc,
      longDesc: data.longDesc,
      bodyPart: data.bodyPart,
      equipment: data.equipment,
      difficulty: data.difficulty,
      imageUrl: data.imageUrl,
      videoUrl: data.videoUrl,
    },
  });
}

async function deleteExercise(id) {
  return prisma.exercise.delete({
    where: { id: Number(id) },
  });
}

module.exports = {
  getAllExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
};
