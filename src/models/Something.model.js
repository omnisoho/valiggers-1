const prisma = require('./prismaClient');

module.exports.createSomething = function createSomething(name, assignedPersonId = []) {
  // Reference: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#explicit-many-to-many-relations
  return prisma.something
    .create({
      data: {
        name,
      },
    })
    .then((something) => {
      console.log('Something created:', something);
      return something;
    });
};

module.exports.getAllSomethings = function getAllSomethings() {
  return prisma.something
    .findMany()
    .then((somethings) => {
      console.log('All somethings:', somethings);
      return somethings;
    });
};

module.exports.updateSomething = function updateSomething(id, data) {
  return prisma.something
    .update({
      where: { id },
      data,
    })
    .then((something) => {
      console.log('Something updated:', something);
      return something;
    });
};

module.exports.deleteSomething = function deleteSomething(id) {
  return prisma.something
    .delete({
      where: { id },
    })
    .then((something) => {
      console.log('Something deleted:', something);
      return something;
    });
};
