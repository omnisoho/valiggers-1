const express = require("express");
const router = express.Router();
const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

// POST /api/temp/seed-coaches
router.post("/seed-coaches", async (req, res) => {
  try {
    // 1) Create a few users first (CoachProfile needs userId)
    const seedUsers = [
      { email: "coach1@test.com", username: "coach1", password: "password123", age: 28, gender: "M" },
      { email: "coach2@test.com", username: "coach2", password: "password123", age: 31, gender: "F" },
      { email: "coach3@test.com", username: "coach3", password: "password123", age: 35, gender: "M" },
    ];

    // Use upsert so you can call this route multiple times without crashing
    const createdUsers = [];
    for (const u of seedUsers) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {}, // don't overwrite existing
        create: u,
      });
      createdUsers.push(user);
    }

    // 2) Create CoachProfiles linked to those users
    const seedCoaches = [
      {
        userId: createdUsers[0].user_id,
        displayName: "Alex Tan",
        bio: "Strength coach focusing on progressive overload.",
        specialties: ["STRENGTH", "HYPERTROPHY"],
        hourlyRate: new Prisma.Decimal("60.00"),
        avatarUrl: "https://picsum.photos/200?1",
        isActive: true,
      },
      {
        userId: createdUsers[1].user_id,
        displayName: "Sarah Lim",
        bio: "Mobility + rehab specialist to keep you pain-free.",
        specialties: ["MOBILITY", "REHAB"],
        hourlyRate: new Prisma.Decimal("75.00"),
        avatarUrl: "https://picsum.photos/200?2",
        isActive: true,
      },
      {
        userId: createdUsers[2].user_id,
        displayName: "Daniel Wong",
        bio: "Weight loss coach with nutrition-first programming.",
        specialties: ["WEIGHT_LOSS", "NUTRITION"],
        hourlyRate: new Prisma.Decimal("65.00"),
        avatarUrl: "https://picsum.photos/200?3",
        isActive: true,
      },
    ];

    for (const c of seedCoaches) {
      await prisma.coachProfile.upsert({
        where: { userId: c.userId },
        update: {}, // don't overwrite existing
        create: c,
      });
    }

    return res.status(200).json({
      message: "Seeded coach users + coach profiles",
      usersCreatedOrFound: createdUsers.length,
      coachesCreatedOrFound: seedCoaches.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;