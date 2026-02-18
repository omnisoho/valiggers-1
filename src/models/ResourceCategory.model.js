const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAllCategories() {
  return prisma.resourceCategory.findMany({
    orderBy: { name: 'asc' }
  });
}

async function createCategory(data) {
  return prisma.resourceCategory.create({
    data: {
      name: data.name,
      slug: data.slug,
    }
  });
}

module.exports = {
  getAllCategories,
  createCategory
};