const prisma = require("./prismaClient");

// ===== SG date helpers (no external libs) =====
function getSgMidnightDate() {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;

  return new Date(`${y}-${m}-${d}T00:00:00+08:00`);
}

function getSgDayKey() {
  const weekday = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "long",
  }).format(new Date());

  return weekday.toLowerCase(); // monday...sunday
}

function getPresetIdFromPlan(plan, dayKey) {
  if (!plan) return null;
  switch (dayKey) {
    case "monday": return plan.mondayId;
    case "tuesday": return plan.tuesdayId;
    case "wednesday": return plan.wednesdayId;
    case "thursday": return plan.thursdayId;
    case "friday": return plan.fridayId;
    case "saturday": return plan.saturdayId;
    case "sunday": return plan.sundayId;
    default: return null;
  }
}

function isValidTransition(from, to) {
  const allowed = {
    NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["PAUSED", "COMPLETED", "CANCELLED"],
    PAUSED: ["IN_PROGRESS", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  return (allowed[from] || []).includes(to);
}

function getTodayAssignedPreset(userId) {
  const dayKey = getSgDayKey();

  return prisma.weeklyPlan
    .findUnique({
      where: { userId },
      select: {
        mondayId: true,
        tuesdayId: true,
        wednesdayId: true,
        thursdayId: true,
        fridayId: true,
        saturdayId: true,
        sundayId: true,
      },
    })
    .then((plan) => {
      const presetId = getPresetIdFromPlan(plan, dayKey);
      if (!presetId) return { dayKey, preset: null };

      return prisma.preset
        .findUnique({
          where: { id: presetId },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: { workout: true },
            },
          },
        })
        .then((preset) => ({ dayKey, preset }));
    });
}

function listTodaySessions(userId, date) {
  return prisma.workoutSession.findMany({
    where: { userId, date, isArchived: false },
    include: { workout: true, sourcePreset: true },
    orderBy: { id: "asc" },
  });
}

function createSessionsFromPreset(userId, date, dayKey, preset) {
  const items = preset.items || [];
  if (!items.length) return Promise.resolve([]);

  // Turn preset items into Workout IDs.
  // - Normal library workouts: item.workoutId
  // - Custom preset workouts (no workoutId): create/find a private Workout row so sessions can reference it.
  return Promise.all(
    items.map((it) => {
      // normal item
      if (it.workoutId) return Promise.resolve(it.workoutId);

      // custom item
      const name = (it.customName || "").trim();
      if (!name) return Promise.resolve(null);

      // Keep custom workouts out of the public library by tagging muscleGroup as "CUSTOM"
      return prisma.workout
        .findFirst({
          where: {
            createdById: userId,
            name,
            muscleGroup: "CUSTOM",
          },
          select: { id: true },
        })
        .then((existing) => {
          if (existing) return existing.id;

          return prisma.workout
            .create({
              data: {
                name,
                muscleGroup: "CUSTOM",
                difficulty: preset.difficulty ?? null,
                durationMin: it.customDurationMin ?? null,
                sets: it.customSets ?? null,
                reps: it.customReps ?? null,
                description: it.customNotes || "",
                createdById: userId,
              },
              select: { id: true },
            })
            .then((w) => w.id);
        });
    })
  )
    .then((ids) => ids.filter(Boolean))
    .then((ids) => {
      // sessions table has a unique constraint, so we can only have 1 session per workout per day (active/archived).
      // De-dupe to avoid unnecessary create conflicts.
      const workoutIds = Array.from(new Set(ids));

      if (!workoutIds.length) return [];

      return prisma.workoutSession
        .createMany({
          data: workoutIds.map((workoutId) => ({
            userId,
            date,
            dayKey,
            workoutId,
            sourcePresetId: preset.id,
            sourcePresetUpdatedAt: preset.updatedAt,
            state: "NOT_STARTED",
          })),
          skipDuplicates: true,
        })
        .then(() => listTodaySessions(userId, date));
    });
}


module.exports.getTodayContext = function getTodayContext(userId) {
  const date = getSgMidnightDate();

  return getTodayAssignedPreset(userId).then(({ dayKey, preset }) => {
    // no preset assigned
    if (!preset) {
      return {
        hasPlan: false,
        reason: "NO_PRESET_ASSIGNED",
        dayKey,
        preset: null,
        sessions: [],
        isOutdated: false,
      };
    }

    const workoutsCount = (preset.items || []).filter((i) => i.workoutId).length;
    if (workoutsCount === 0) {
      return {
        hasPlan: false,
        reason: "PRESET_EMPTY",
        dayKey,
        preset: { id: preset.id, name: preset.name, updatedAt: preset.updatedAt },
        sessions: [],
        isOutdated: false,
      };
    }

    // load sessions, if none create snapshot
    return listTodaySessions(userId, date).then((sessions) => {
      const ensureSessions = sessions.length
        ? Promise.resolve(sessions)
        : createSessionsFromPreset(userId, date, dayKey, preset);

      return ensureSessions.then((finalSessions) => {
        const snapPresetId = finalSessions[0]?.sourcePresetId;
        const snapUpdatedAt = finalSessions[0]?.sourcePresetUpdatedAt;

        const isOutdated =
          snapPresetId !== preset.id ||
          (snapUpdatedAt &&
            new Date(snapUpdatedAt).getTime() !== new Date(preset.updatedAt).getTime());

        return {
          hasPlan: true,
          reason: null,
          dayKey,
          preset: { id: preset.id, name: preset.name, updatedAt: preset.updatedAt },
          sessions: finalSessions,
          isOutdated,
        };
      });
    });
  });
};

module.exports.switchToLatestPresetForToday = function switchToLatestPresetForToday(userId) {
  const date = getSgMidnightDate();

  return getTodayAssignedPreset(userId).then(({ dayKey, preset }) => {
    if (!preset) {
      return { ok: false, message: "No preset assigned for today.", hasPlan: false, sessions: [] };
    }

    const workoutsCount = (preset.items || []).filter((i) => i.workoutId).length;
    if (workoutsCount === 0) {
      return { ok: false, message: "Today’s preset has no workouts.", hasPlan: false, sessions: [] };
    }

    return prisma.workoutSession
      .findMany({
        where: { userId, date, isArchived: false },
        select: { workoutId: true },
      })
      .then((activeRows) => {
        const workoutIds = activeRows.map((r) => r.workoutId);

        // If the user has already switched once today, there may already be an archived row
        // with the same (userId, date, workoutId, isArchived=true). Delete those first to avoid P2002.
        const tx = [];
        if (workoutIds.length) {
          tx.push(
            prisma.workoutSession.deleteMany({
              where: { userId, date, isArchived: true, workoutId: { in: workoutIds } },
            })
          );
        }

        tx.push(
          prisma.workoutSession.updateMany({
            where: { userId, date, isArchived: false },
            data: { isArchived: true, archivedAt: new Date() },
          })
        );

        return prisma.$transaction(tx);
      })
      .then(() => createSessionsFromPreset(userId, date, dayKey, preset))
      .then((sessions) => ({
        ok: true,
        hasPlan: true,
        preset: { id: preset.id, name: preset.name, updatedAt: preset.updatedAt },
        sessions,
      }));
  });
};

module.exports.updateSessionState = function updateSessionState(sessionId, userId, nextState) {
  const to = String(nextState || "").toUpperCase();

  return prisma.workoutSession.findUnique({ where: { id: sessionId } }).then((session) => {
    if (!session || session.userId !== userId || session.isArchived) {
      return Promise.reject(Object.assign(new Error("Session not found"), { status: 404 }));
    }

    const from = session.state;
    if (!isValidTransition(from, to)) {
      return Promise.reject(Object.assign(new Error(`Invalid transition: ${from} → ${to}`), { status: 409 }));
    }

    const data = { state: to };
    if (to === "IN_PROGRESS" && !session.startedAt) data.startedAt = new Date();
    if ((to === "COMPLETED" || to === "CANCELLED") && !session.endedAt) data.endedAt = new Date();

    return prisma.workoutSession.update({
      where: { id: sessionId },
      data,
      include: { workout: true, sourcePreset: true },
    });
  });
};
