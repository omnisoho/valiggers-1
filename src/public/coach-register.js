function getToken() {
  return localStorage.getItem("token");
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg || "";
}

function getSelectedSpecialties() {
  return [...document.querySelectorAll('input[type="checkbox"]:checked')]
    .map(cb => cb.value);
}

async function createCoach(data) {
  const token = getToken();
  if (!token) throw new Error("Please log in first.");

  const res = await fetch("/coaches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed (${res.status})`);
  }

  return res.json();
}


document.getElementById("coachForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    displayName: document.getElementById("displayName").value.trim(),
    bio: document.getElementById("bio").value.trim(),
    specialties: getSelectedSpecialties(),
    hourlyRate: Number(document.getElementById("hourlyRate").value),
    avatarUrl: document.getElementById("avatarUrl").value.trim()
  };

  try {
    setStatus("Creating profile...");
    const coach = await createCoach(data);

    setStatus("Profile created!");
    setTimeout(() => {
      window.location.href = `/coach-detail?id=${coach.id}`;
    }, 800);

  } catch (err) {
  setStatus(err.message);

  if (err.message.includes("Session expired")) {
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  }
}
});
