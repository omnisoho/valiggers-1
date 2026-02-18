const prisma = require('./prismaClient');

// Find user by username
async function findUserByUsername(username) {
  return prisma.user.findUnique({
    where: { username },
  });
}

// Find user by email
async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  });
}

// Create new user (password hashed)
async function createUser({ username, email, passwordHash }) {
  return prisma.user.create({
    data: {
      username,
      email,
      password: passwordHash, //hashed password
    },
  });
}

module.exports = {
  findUserByUsername,
  findUserByEmail,
  createUser,
};