const prisma = require('./prismaClient');

// CREATE comment
module.exports.createComment = function createComment(data) {
  return prisma.comment.create({
    data: {
      text: data.text,
      workoutId: data.workoutId,
      userId: data.userId || null,
    },
  });
};

// GET comments for workout
module.exports.getComments = function getComments(workoutId) {
  return prisma.comment.findMany({
    where: { workoutId },
    orderBy: { createdAt: 'desc' },
  });
};
