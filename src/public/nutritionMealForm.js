const apiUrl = "."; // API base URL
// ✅ Get JWT from localStorage
const token = localStorage.getItem("token");
if (!token) {
  alert("You must be logged in to add a meal.");
}
// Log the raw JWT
console.log("JWT:", token);
// Elements
const mealForm = document.getElementById("mealForm");
const mealPhoto = document.getElementById("mealPhoto");
const photoPreview = document.getElementById("photoPreview");
const fileBtn = document.querySelector(".file-btn");

// Open file picker when clicking custom button
fileBtn.addEventListener("click", () => mealPhoto.click());

// Show preview when user selects photo
mealPhoto.addEventListener("change", () => {
  const file = mealPhoto.files[0];
  const previewBox = document.querySelector(".preview-box");

  if (file) {
    const photoURL = URL.createObjectURL(file);
    photoPreview.src = photoURL;
    previewBox.style.display = "block"; // show the fixed preview box
  } else {
    previewBox.style.display = "none";
    photoPreview.src = "";
  }
});

// Form submit
mealForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get form values
  const mealName = document.getElementById("mealName").value;
  const mealType = document.getElementById("mealType").value;
  const calories = parseInt(document.getElementById("calories").value, 10);
  const protein = parseFloat(document.getElementById("protein").value);
  const fat = parseFloat(document.getElementById("fat").value);
  const sugar = parseFloat(document.getElementById("sugar").value);
  const photoFile = mealPhoto.files[0];

  // Create FormData for file upload
  const formData = new FormData();
  formData.append("mealName", mealName);
  formData.append("mealType", mealType);
  formData.append("calories", calories);
  formData.append("protein", protein);
  formData.append("fat", fat);
  formData.append("sugar", sugar);
  if (photoFile) formData.append("photo", photoFile); // 'photo' matches Multer field

  try {
    const response = await fetch(`${apiUrl}/nutrition`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`, // ✅ send JWT
      },
      body: formData,
    });

    const data = await response.json();
    console.log("Meal saved:", data);

    // Reset form
    mealForm.reset();
    photoPreview.src = "";
    photoPreview.style.display = "none";

    // ✅ Redirect to the tracker page
    window.location.href = "nutritionTracker.html";
  } catch (error) {
    console.error("Error adding meal:", error);
  }
});
