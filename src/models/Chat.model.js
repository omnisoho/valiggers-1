const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Helper: checks if logged-in user is either:
// - student of conversation
// - OR the coach owner (conversation.coach.userId)
async function getConversationIfMember(conversationId, authUserId) {
  const convo = await prisma.chatConversation.findUnique({
    where: { id: Number(conversationId) },
    include: {
      coach: { select: { id: true, userId: true, displayName: true, avatarUrl: true } },
      student: { select: { user_id: true, username: true, pfpUrl: true } },
    },
  });

  if (!convo) return null;

  const isStudent = convo.studentId === Number(authUserId);
  const isCoachOwner = convo.coach.userId === Number(authUserId);

  if (!isStudent && !isCoachOwner) return "FORBIDDEN";
  return convo;
}

// Student creates/gets a conversation with a coach profile
async function createOrGetConversation(studentUserId, coachProfileId) {
  // ensure coach profile exists
  const coach = await prisma.coachProfile.findUnique({
    where: { id: Number(coachProfileId) },
    select: { id: true, userId: true, displayName: true, avatarUrl: true, isActive: true },
  });
  if (!coach) {
    const err = new Error("Coach not found");
    err.status = 404;
    throw err;
  }

  // prevent chatting yourself (optional)
  if (coach.userId === Number(studentUserId)) {
    const err = new Error("You cannot chat with your own coach profile.");
    err.status = 400;
    throw err;
  }

  const convo = await prisma.chatConversation.upsert({
    where: {
      studentId_coachId: {
        studentId: Number(studentUserId),
        coachId: Number(coachProfileId),
      },
    },
    update: {},
    create: {
      studentId: Number(studentUserId),
      coachId: Number(coachProfileId),
    },
    include: {
      coach: { select: { id: true, userId: true, displayName: true, avatarUrl: true } },
      student: { select: { user_id: true, username: true, pfpUrl: true } },
    },
  });

  return convo;
}

// List conversations for logged-in user (as student OR as coach owner)
async function listMyConversations(authUserId) {
  const uid = Number(authUserId);

  // If user owns a coach profile, they can see convos where coach.userId = uid
  // Also show convos where studentId = uid
  const rows = await prisma.chatConversation.findMany({
    where: {
      OR: [
        { studentId: uid },
        { coach: { userId: uid } },
      ],
    },
    include: {
      coach: { select: { id: true, userId: true, displayName: true, avatarUrl: true } },
      student: { select: { user_id: true, username: true, pfpUrl: true } },
      messages: {
        select: { id: true, content: true, createdAt: true, senderRole: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Flatten last message for easier frontend
  return rows.map(r => ({
    id: r.id,
    student: r.student,
    coach: r.coach,
    lastMessageAt: r.lastMessageAt,
    lastMessage: r.messages[0] || null,
  }));
}

async function getMessages(conversationId, authUserId, take = 50, cursorId = null) {
  const convo = await getConversationIfMember(conversationId, authUserId);
  if (convo === "FORBIDDEN") {
    const err = new Error("Not allowed");
    err.status = 403;
    throw err;
  }
  if (!convo) {
    const err = new Error("Conversation not found");
    err.status = 404;
    throw err;
  }

  const where = { conversationId: Number(conversationId) };

  // Optional pagination with cursor
  const msgs = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: Number(take),
    ...(cursorId
      ? { cursor: { id: Number(cursorId) }, skip: 1 }
      : {}),
    include: {
      senderUser: { select: { user_id: true, username: true, pfpUrl: true } },
    },
  });

  return { conversation: convo, messages: msgs };
}

async function sendMessage(conversationId, authUserId, content) {
  const text = String(content || "").trim();
  if (!text) {
    const err = new Error("Message content cannot be empty");
    err.status = 400;
    throw err;
  }

  const convo = await getConversationIfMember(conversationId, authUserId);
  if (convo === "FORBIDDEN") {
    const err = new Error("Not allowed");
    err.status = 403;
    throw err;
  }
  if (!convo) {
    const err = new Error("Conversation not found");
    err.status = 404;
    throw err;
  }

  const uid = Number(authUserId);
  const senderRole = (convo.studentId === uid) ? "STUDENT" : "COACH";

  const msg = await prisma.chatMessage.create({
    data: {
      conversationId: Number(conversationId),
      senderRole,
      senderUserId: uid,
      content: text,
    },
    include: {
      senderUser: { select: { user_id: true, username: true, pfpUrl: true } },
    },
  });

  await prisma.chatConversation.update({
    where: { id: Number(conversationId) },
    data: { lastMessageAt: new Date() },
  });

  return msg;
}

module.exports = {
  createOrGetConversation,
  listMyConversations,
  getMessages,
  sendMessage,
};
