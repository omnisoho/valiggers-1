// ========================
// HELPER: APPLY PROFILE DATA TO DOM
// ========================
function applyProfileToDOM(data) {
    const usernameEl = document.getElementById("profileName");
    const bioEl = document.querySelector(".profile-bio");

    if (usernameEl) usernameEl.textContent = data.username || "Your Profile";
    if (bioEl) bioEl.textContent = data.bio || "—";

    const weightEl = document.getElementById("display-weight");
    const bodyfatEl = document.getElementById("display-bodyfat");
    const heightEl = document.getElementById("display-height");

    if (weightEl) {
        weightEl.textContent = data.weight != null && data.weight !== ""
            ? data.weight + " kg"
            : "— kg";
    }
    if (bodyfatEl) {
        bodyfatEl.textContent = data.bodyfat != null && data.bodyfat !== ""
            ? data.bodyfat + " %"
            : "— %";
    }
    if (heightEl) {
        heightEl.textContent = data.height != null && data.height !== ""
            ? data.height + " cm"
            : "— cm";
    }

    const mainPfp = document.querySelector(".pfp");
    if (mainPfp && data.pfpUrl) mainPfp.src = data.pfpUrl;

    // Pre-fill modal fields
    const editName = document.getElementById("edit-name");
    const editBio = document.getElementById("edit-bio");
    const statWeight = document.getElementById("stat-weight");
    const statBodyfat = document.getElementById("stat-bodyfat");
    const statHeight = document.getElementById("stat-height");

    if (editName) editName.value = data.username || "";
    if (editBio) editBio.value = data.bio || "";
    if (statWeight) statWeight.value = data.weight != null ? data.weight : "";
    if (statBodyfat) statBodyfat.value = data.bodyfat != null ? data.bodyfat : "";
    if (statHeight) statHeight.value = data.height != null ? data.height : "";
}

// ========================
// LOAD PROFILE FROM BACKEND
// ========================
async function loadProfileFromDB() {
    const token = localStorage.getItem("token");
    if (!token) {
        // Not logged in: just leave default text
        return;
    }

    try {
        const res = await fetch("/api/profile", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) {
            console.error("Failed to load profile:", await res.text());
            return;
        }

        const data = await res.json();
        applyProfileToDOM(data);
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

loadProfileFromDB();

// ========================
// GOALS
// ========================
const goalsList = document.getElementById("goalsList");
const addGoalBtn = document.getElementById("addGoalBtn");

if (addGoalBtn) {
    addGoalBtn.addEventListener("click", () => {
        const goal = prompt("Enter your new goal:");
        if (!goal || goal.trim() === "") return;

        const li = document.createElement("li");
        li.className = "goal-item";
        li.innerHTML = `
            ${goal}
            <i class="bi bi-check-circle goal-complete"></i>
        `;

        li.querySelector(".goal-complete").addEventListener("click", () => {
            if (confirm("Mark goal as completed?")) {
                li.remove();
            }
        });

        goalsList.appendChild(li);
    });
}

// ========================
// NOTES FEATURE
// ========================

const notesGrid = document.getElementById("notesGrid");
const addNoteBtnNew = document.getElementById("addNoteBtn");
const notesCountEl = document.getElementById("notes-count");
const sortDropdown = document.getElementById("notesSort");

async function loadNotes() {
    const token = localStorage.getItem("token");

    // read from dropdown
    const sort = document.getElementById("sortLabel").textContent.includes("Latest")
        ? "latest"
        : "oldest";

    const res = await fetch(`/api/notes?sort=${sort}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
        console.error("Failed to load notes:", await res.text());
        return;
    }

    const notes = await res.json();

    // 1️⃣ Separate pinned & unpinned
    const pinned = notes.filter(n => n.pinned);
    const unpinned = notes.filter(n => !n.pinned);

    // 2️⃣ Combine them so pinned ALWAYS appear first
    const orderedNotes = [...pinned, ...unpinned];

    // 3️⃣ Update UI
    notesGrid.innerHTML = "";
    notesCountEl.textContent = `${notes?.length || 0} notes`;

    orderedNotes.forEach(n => createNoteCard(n));
}

function createNoteCard(note) {
    const card = document.createElement("div");
    card.className = "note-card";
    card.innerHTML = `
        <div>${note.content}</div>
        <i class="bi bi-pin-angle-fill note-pin" style="color:${note.pinned ? '#4cc9f0' : '#777'}"></i>
    `;

    // open modal
    card.addEventListener("click", (e) => {
        if (e.target.classList.contains("note-pin")) return; 
        openNoteModal(note);
    });

    card.querySelector(".note-pin").addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        await fetch(`/api/notes/${note.note_id}/pin`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` }
        });
        loadNotes();
    });

    notesGrid.appendChild(card);
}

// ========================
// CREATE NOTE MODAL
// ========================
const createNoteModal = document.getElementById("createNoteModal");
const newNoteContent = document.getElementById("newNoteContent");
const saveCreateNote = document.getElementById("saveCreateNote");
const cancelCreateNote = document.getElementById("cancelCreateNote");

// open modal
addNoteBtnNew.addEventListener("click", () => {
    newNoteContent.value = "";
    createNoteModal.classList.remove("d-none");
});

// close modal
cancelCreateNote.addEventListener("click", () => {
    createNoteModal.classList.add("d-none");
});

// save note
saveCreateNote.addEventListener("click", async () => {
    const content = newNoteContent.value.trim();
    if (!content) return;

    const token = localStorage.getItem("token");

    await fetch("/api/notes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
    });

    createNoteModal.classList.add("d-none");
    loadNotes();
});
loadNotes();

// ========================
// CUSTOM SORT DROPDOWN LOGIC
// ========================

document.querySelectorAll(".sort-option").forEach(option => {
    option.addEventListener("click", () => {
        const value = option.dataset.value;

        // update label text
        document.getElementById("sortLabel").textContent =
            value === "latest" ? "Latest First" : "Oldest First";

        // highlight active
        document.querySelectorAll(".sort-option").forEach(o =>
            o.classList.remove("active")
        );
        option.classList.add("active");

        // reload notes
        loadNotes();
    });
});



// ========================
// PROFILE MODAL OPEN/CLOSE
// ========================
const profileModal = document.getElementById("profileModal");
const closeProfileModal = document.getElementById("closeProfileModal");

// OPEN PROFILE MODAL (WORKS EVEN INSIDE DROPDOWN)
document.addEventListener("click", (e) => {
    if (e.target.id === "openProfileModal") {
        // Name + bio already synced from DB via applyProfileToDOM
        if (profileModal) {
            profileModal.classList.remove("d-none");
        }
    }
});

// CLOSE MODAL
if (closeProfileModal) {
    closeProfileModal.addEventListener("click", () => {
        profileModal.classList.add("d-none");
    });
}

// ========================
// SAVE PROFILE (USERNAME + BIO + STATS) TO BACKEND
// ========================
const saveProfileBtn = document.getElementById("saveProfileBtn");

if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "./login.html";
        return;
    }

    const formData = new FormData();
    formData.append("username", document.getElementById("edit-name").value);
    formData.append("bio", document.getElementById("edit-bio").value);
    formData.append("weight", document.getElementById("stat-weight").value);
    formData.append("bodyfat", document.getElementById("stat-bodyfat").value);
    formData.append("height", document.getElementById("stat-height").value);

    // Add file only if selected
    if (selectedPfpFile) {
        formData.append("pfp", selectedPfpFile);
    }

    try {
        const res = await fetch("/api/profile/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
            alert(result.error || "Failed to update profile");
            return;
        }

        // update DOM
        applyProfileToDOM(result.profile);

        // update pfp in main profile header
        document.querySelector(".pfp").src = result.profile.pfpUrl;

        // close modal
        profileModal.classList.add("d-none");
        
        selectedPfpFile = null;
    } catch (err) {
        console.error("PFP upload error:", err);
    }
});
}

// ========================
// NOTES MODAL
// ========================
let currentNoteId = null;

function openNoteModal(note) {
    currentNoteId = note.note_id;
    document.getElementById("noteModalContent").textContent = note.content;
    document.getElementById("noteModal").classList.remove("d-none");
}

function closeNoteModal() {
    document.getElementById("noteModal").classList.add("d-none");
}

document.getElementById("deleteNoteBtn").addEventListener("click", async () => {
    const token = localStorage.getItem("token");
    await fetch(`/api/notes/${currentNoteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
    });
    closeNoteModal();
    loadNotes();
});


// ========================
// LOGOUT MODAL & LOGIC
// ========================
const logoutModal = document.getElementById("logoutModal");
const cancelLogout = document.getElementById("cancelLogout");
const confirmLogout = document.getElementById("confirmLogout");
const logoutFromMenu = document.getElementById("logoutFromMenu");
const logoutBtnModal = document.getElementById("logoutBtnModal");

function openLogoutModal() {
    if (logoutModal) logoutModal.classList.remove("d-none");
}

if (logoutFromMenu) logoutFromMenu.addEventListener("click", openLogoutModal);
if (logoutBtnModal) logoutBtnModal.addEventListener("click", openLogoutModal);

if (cancelLogout) {
    cancelLogout.addEventListener("click", () => {
        logoutModal.classList.add("d-none");
    });
}

if (confirmLogout) {
    confirmLogout.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "./login.html";
    });
}


// ========================
// PROFILE PICTURE UPLOAD
// ========================
const choosePfpBtn = document.getElementById("choosePfpBtn");
const pfpInput = document.getElementById("pfpFileInput");
const modalPfpPreview = document.getElementById("modalPfpPreview");

let selectedPfpFile = null;

choosePfpBtn.addEventListener("click", () => {
    pfpInput.click();
});

pfpInput.addEventListener("change", () => {
    const file = pfpInput.files[0];
    if (!file) return;

    selectedPfpFile = file;

    // preview
    const url = URL.createObjectURL(file);
    modalPfpPreview.src = url;
});
