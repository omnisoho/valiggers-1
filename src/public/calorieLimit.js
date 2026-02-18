const apiUrl = "."; // Adjust this URL if your API is hosted elsewhere

  // ✅ Get JWT from localStorage
  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in to add a meal.');
  }
// Log the raw JWT
console.log("JWT:", token);

function updateCalorieLimit(value) {
  console.log("Sending calorie limit:", value);

   fetch(`${apiUrl}/nutrition/updateLimit`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`, // ✅ send JWT
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ calorieLimit: value }), // no userId
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Updated:", data);
      window.location.href = "nutritionTracker.html"; // ✅ redirect back
    })
    .catch((err) => console.error("Error:", err));
}

// 2️⃣ Handle card clicks
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("click", () => {
    const calories = card
      .querySelector(".card-calories")
      .textContent.replace(/[^0-9]/g, ""); // extract number only

    updateCalorieLimit(Number(calories));
  });
});

// 3️⃣ Handle custom input
const input = document.querySelector(".custom-input input");
const button = document.querySelector(".custom-input button");

button.addEventListener("click", () => {
  const value = Number(input.value);

  if (!value || value <= 0) {
    alert("Enter a valid calorie number");
    return;
  }

  updateCalorieLimit(value);
});
