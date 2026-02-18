const prisma = require('./prismaClient');

// CREATE workout
module.exports.createWorkout = function createWorkout(data) {
  return prisma.workout.create({
    data: {
      name: data.name,
      muscleGroup: data.muscleGroup,
      difficulty: data.difficulty || null,
      durationMin: data.durationMin || null,
      sets: data.sets || null,
      reps: data.reps || null,
      description: data.description,
      createdById: data.createdById || null,
    },
    include: {
      comments: true,
    },
  });
};

// GET all workouts
module.exports.getAllWorkouts = function getAllWorkouts() {
  return prisma.workout.findMany({
    include: {
      comments: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

// GET single workout
module.exports.getWorkoutById = function getWorkoutById(id) {
  return prisma.workout.findUnique({
    where: { id },
    include: {
      comments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

// UPDATE workout (do not allow changing createdById here)
module.exports.updateWorkout = function updateWorkout(id, data) {
  const updateData = {
    name: data.name,
    muscleGroup: data.muscleGroup,
    difficulty: data.difficulty || null,
    durationMin: data.durationMin || null,
    sets: data.sets || null,
    reps: data.reps || null,
    description: data.description,
  };

  return prisma.workout.update({
    where: { id },
    data: updateData,
  });
};

// DELETE workout
module.exports.deleteWorkout = function deleteWorkout(id) {
  return prisma.workout.delete({
    where: { id },
  });
};

// UPVOTE
module.exports.upvoteWorkout = function upvoteWorkout(id) {
  return prisma.workout.update({
    where: { id },
    data: { upvotes: { increment: 1 } },
  });
};

// DOWNVOTE
module.exports.downvoteWorkout = function downvoteWorkout(id) {
  return prisma.workout.update({
    where: { id },
    data: { downvotes: { increment: 1 } },
  });
};
