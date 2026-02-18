const prisma = require('./prismaClient');

// Fetch profile by userId
async function getProfile(userId) {
  return prisma.user.findUnique({
    where: { user_id: userId },
    select: {
      username: true,
      bio: true,
      weight: true,
      bodyfat: true,
      height: true,
      pfpUrl: true
    }
  });
}

// Update profile fields
async function updateProfile(userId, data) {
  return prisma.user.update({
    where: { user_id: userId },
    data: {
      username: data.username || undefined,
      bio: data.bio,
      weight: data.weight ? parseFloat(data.weight) : null,
      bodyfat: data.bodyfat ? parseFloat(data.bodyfat) : null,
      height: data.height ? parseFloat(data.height) : null,
      pfpUrl: data.pfpUrl || null
    }
  });
}


module.exports = {
  getProfile,
  updateProfile,
};