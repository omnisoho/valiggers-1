const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function asDate(x) {
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function throwErr(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

async function ensureCoachExists(coachId) {
  const coach = await prisma.coachProfile.findFirst({
    where: { id: Number(coachId), isActive: true },
    select: { id: true, userId: true },
  });
  if (!coach) throwErr(404, "Coach not found or inactive.");
  return coach;
}

async function ensureNoOverlap(coachId, startAt, endAt) {
  const conflict = await prisma.coachBooking.findFirst({
    where: {
      coachId: Number(coachId),
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (conflict) throwErr(409, "Coach is not available for that time slot.");
}

async function createBooking(studentId, data) {
  const coachId = Number(data.coachId);
  if (!coachId) throwErr(400, "coachId is required.");

  const startAt = asDate(data.startAt);
  const endAt = asDate(data.endAt);

  if (!startAt) throwErr(400, "Invalid startAt.");
  if (!endAt) throwErr(400, "Invalid endAt.");
  if (endAt <= startAt) throwErr(400, "endAt must be after startAt.");
  if (startAt <= new Date()) throwErr(400, "Booking must be in the future.");

  const coach = await ensureCoachExists(coachId);

  // optional but good
  if (Number(coach.userId) === Number(studentId)) {
    throwErr(400, "You cannot book yourself.");
  }

  await ensureNoOverlap(coachId, startAt, endAt);

  return prisma.coachBooking.create({
    data: {
      coachId,
      studentId: Number(studentId),
      startAt,
      endAt,
      notes: (data.notes || "").trim() || null,
      status: "PENDING",
    },
  });
}

async function getMyBookings(studentId) {
  return prisma.coachBooking.findMany({
    where: { studentId: Number(studentId) },
    include: {
      coach: {
        select: { id: true, displayName: true, avatarUrl: true, hourlyRate: true },
      },
    },
    orderBy: { startAt: "desc" },
  });
}

// Coach side: bookings for the coach profile owned by this user
async function getCoachBookingsForMe(coachUserId) {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: Number(coachUserId) },
    select: { id: true },
  });
  if (!coach) return [];

  return prisma.coachBooking.findMany({
    where: { coachId: coach.id },
    include: {
      student: { select: { user_id: true, username: true, pfpUrl: true } },
    },
    orderBy: { startAt: "desc" },
  });
}

function isAllowedTransition(from, to) {
  const rules = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  return (rules[from] || []).includes(to);
}

async function coachUpdateStatus(bookingId, coachUserId, nextStatus) {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: Number(coachUserId) },
    select: { id: true },
  });
  if (!coach) throwErr(403, "You are not a coach.");

  const booking = await prisma.coachBooking.findUnique({
    where: { id: Number(bookingId) },
  });

  if (!booking || booking.coachId !== coach.id) {
    throwErr(403, "Not allowed.");
  }

  const to = String(nextStatus || "").toUpperCase();
  if (!["CONFIRMED", "COMPLETED", "CANCELLED"].includes(to)) {
    throwErr(400, "Invalid status. Use CONFIRMED, COMPLETED, or CANCELLED.");
  }

  if (!isAllowedTransition(booking.status, to)) {
    throwErr(400, `Cannot change status from ${booking.status} to ${to}.`);
  }

  return prisma.coachBooking.update({
    where: { id: booking.id },
    data: { status: to },
  });
}

async function studentCancelBooking(bookingId, studentId) {
  const booking = await prisma.coachBooking.findUnique({
    where: { id: Number(bookingId) },
  });

  if (!booking || booking.studentId !== Number(studentId)) {
    throwErr(403, "Not allowed.");
  }
  if (booking.status === "COMPLETED") {
    throwErr(400, "Cannot cancel a completed booking.");
  }
  if (booking.status === "CANCELLED") return booking;

  return prisma.coachBooking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });
}

module.exports = {
  createBooking,
  getMyBookings,
  getCoachBookingsForMe,
  coachUpdateStatus,
  studentCancelBooking,
};
