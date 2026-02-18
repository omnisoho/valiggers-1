const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function buildWhere(filters = {}) {
  const where = { isActive: true };
  const { search, specialty, minRate, maxRate, userId } = filters;

  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { bio: { contains: search, mode: "insensitive" } },
      { user: { username: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (specialty) {
    // specialty is a single enum string (e.g. "STRENGTH")
    where.specialties = { has: specialty };
  }

  if (minRate || maxRate) {
    where.hourlyRate = {};
    if (minRate) where.hourlyRate.gte = Number(minRate);
    if (maxRate) where.hourlyRate.lte = Number(maxRate);
  }

  if (userId) {
    where.userId = Number(userId);
  }

  return where;
}

async function getCoachStatsByCoachIds(coachIds) {
  if (!coachIds.length) return new Map();

  const grouped = await prisma.coachReview.groupBy({
    by: ["coachId"],
    where: { coachId: { in: coachIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const map = new Map();
  for (const row of grouped) {
    map.set(row.coachId, {
      avgRating: row._avg.rating ?? 0,
      reviewCount: row._count._all ?? 0,
    });
  }
  return map;
}

function applySort(coaches, sort) {
  // sort is done after we attach avgRating/reviewCount
  switch (sort) {
    case "rating_desc":
      return coaches.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
    case "reviews_desc":
      return coaches.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "price_asc":
      return coaches.sort((a, b) => Number(a.hourlyRate) - Number(b.hourlyRate));
    case "price_desc":
      return coaches.sort((a, b) => Number(b.hourlyRate) - Number(a.hourlyRate));
    case "newest":
    default:
      return coaches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

async function getAllCoaches(filters) {
  const where = buildWhere(filters);

  const coaches = await prisma.coachProfile.findMany({
    where,
    include: {
      user: {
        select: {
          user_id: true,
          username: true,
          pfpUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const ids = coaches.map((c) => c.id);
  const statsMap = await getCoachStatsByCoachIds(ids);

  const enriched = coaches.map((c) => {
    const stats = statsMap.get(c.id) || { avgRating: 0, reviewCount: 0 };
    return {
      ...c,
      avgRating: Number(stats.avgRating.toFixed ? stats.avgRating.toFixed(2) : stats.avgRating),
      reviewCount: stats.reviewCount,
    };
  });

  return applySort(enriched, filters.sort);
}

async function getCoachById(id) {
  const coach = await prisma.coachProfile.findUnique({
    where: { id: Number(id) },
    include: {
      user: {
        select: {
          user_id: true,
          username: true,
          pfpUrl: true,
          bio: true,
        },
      },
      reviews: {
        include: {
          user: { select: { user_id: true, username: true, pfpUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!coach) return null;

  const agg = await prisma.coachReview.aggregate({
    where: { coachId: Number(id) },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return {
    ...coach,
    avgRating: Number((agg._avg.rating ?? 0).toFixed(2)),
    reviewCount: agg._count._all ?? 0,
  };
}

async function createCoachProfile(userId, data) {
  return prisma.coachProfile.create({
    data: {
      userId: Number(userId),
      displayName: data.displayName,
      bio: data.bio ?? null,
      specialties: Array.isArray(data.specialties) ? data.specialties : [],
      hourlyRate: Number(data.hourlyRate),
      avatarUrl: data.avatarUrl ?? null,
      isActive: data.isActive ?? true,
    },
    include: { user: { select: { user_id: true, username: true, pfpUrl: true } } },
  });
}

async function updateCoachProfile(coachId, userId, data) {
  // only allow update if the profile belongs to the logged-in user
  const updated = await prisma.coachProfile.updateMany({
    where: { id: Number(coachId), userId: Number(userId) },
    data: {
      displayName: data.displayName,
      bio: data.bio ?? null,
      ...(data.specialties && { specialties: data.specialties }),
      ...(data.hourlyRate !== undefined && { hourlyRate: Number(data.hourlyRate) }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl ?? null }),
      ...(data.isActive !== undefined && { isActive: !!data.isActive }),
    },
  });

  if (updated.count === 0) return null;
  return getCoachById(coachId);
}

async function upsertReview(coachId, userId, data) {
  const rating = Number(data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const err = new Error("rating must be an integer from 1 to 5");
    err.status = 400;
    throw err;
  }

  const ok = await canUserReviewCoach(coachId, userId);
  if (!ok) {
    const err = new Error("You can only review a coach after completing a booking.");
    err.status = 403;
    throw err;
  }

  return prisma.coachReview.upsert({
    where: {
      coachId_userId: {
        coachId: Number(coachId),
        userId: Number(userId),
      },
    },
    update: {
      rating,
      comment: data.comment ?? null,
    },
    create: {
      coachId: Number(coachId),
      userId: Number(userId),
      rating,
      comment: data.comment ?? null,
    },
    include: {
      user: { select: { user_id: true, username: true, pfpUrl: true } },
    },
  });
}

async function deleteReview(reviewId, userId) {
  // only owner can delete
  const deleted = await prisma.coachReview.deleteMany({
    where: { id: Number(reviewId), userId: Number(userId) },
  });
  return deleted.count > 0;
}

async function canUserReviewCoach(coachId, userId) {
  // Must have at least one completed booking with this coach
  const count = await prisma.coachBooking.count({
    where: {
      coachId: Number(coachId),
      studentId: Number(userId),
      status: "COMPLETED",
    },
  });

  return count > 0;
}

module.exports = {
  getAllCoaches,
  getCoachById,
  createCoachProfile,
  updateCoachProfile,
  upsertReview,
  deleteReview,
  canUserReviewCoach,
};