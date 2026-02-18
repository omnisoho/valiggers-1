const prisma = require('./prismaClient');

// Get all notes for a user
async function getNotes(userId, sort = "latest") {
  return prisma.note.findMany({
    where: { userId },
    orderBy: {
      createdAt: sort === "latest" ? "desc" : "asc"
    }
  });
}

// Create a note
async function createNote(userId, content) {
  return prisma.note.create({
    data: { userId, content }
  });
}

// Delete a note
async function deleteNote(noteId, userId) {
  return prisma.note.delete({
    where: { note_id: noteId, },
  });
}

// Toggle pin
async function togglePin(noteId, userId) {
  const note = await prisma.note.findUnique({ where: { note_id: noteId } });
  return prisma.note.update({
    where: { note_id: noteId },
    data: { pinned: !note.pinned }
  });
}

module.exports = {
  getNotes,
  createNote,
  deleteNote,
  togglePin
};
