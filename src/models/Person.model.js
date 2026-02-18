const prisma = require('./prismaClient');

module.exports.getAllPersons = async function getAllPersons() {
  return prisma.person.findMany();
};
