const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function buildWhere(filters = {}) {
  const where = {};
  const { search, category, difficulty, type } = filters;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (difficulty) {
    where.difficulty = difficulty; // BEGINNER / INTERMEDIATE / ADVANCED
  }

  if (type) {
    where.type = type; // ARTICLE / VIDEO / LINK / PDF
  }

  if (category) {
    where.category = {
      slug: category, // e.g. "strength"
    };
  }

  return where;
}

async function getAllResources(filters) {
  const where = buildWhere(filters);

  return prisma.resource.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function getResourceById(id) {
  return prisma.resource.findUnique({
    where: { id: Number(id) },
    include: { category: true },
  });
}

async function createResource(data) {
  return prisma.resource.create({
    data: {
      title: data.title,
      description: data.description,
      url: data.url,
      type: data.type,             // must match enum
      difficulty: data.difficulty, // must match enum
      category: {
        connect: { id: Number(data.categoryId) },
      },
    },
    include: { category: true },
  });
}

async function updateResource(id, data) {
  return prisma.resource.update({
    where: { id: Number(id) },
    data: {
      title: data.title,
      description: data.description,
      url: data.url,
      type: data.type,
      difficulty: data.difficulty,
      ...(data.categoryId && {
        category: { connect: { id: Number(data.categoryId) } },
      }),
    },
    include: { category: true },
  });
}

async function deleteResource(id) {
  return prisma.resource.delete({
    where: { id: Number(id) },
  });
}

module.exports = {
  getAllResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
};