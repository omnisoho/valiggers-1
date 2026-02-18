const prisma = require("./prismaClient");

//ALL USER ID CHANGE TO TEXT FOR NOW(WHEN MIGRATION FIX)
// CREATE a meal
module.exports.CreateMeal = async (req, res) => {
  try {
 const { mealName, mealType, calories, protein, fat, sugar } = req.body;
const userId = req.user.userId;
const photoUrl = req.file ? `/uploads/${req.file.filename}` : "";

// Find or create UserMeal
let userMeal = await prisma.userMeal.findUnique({
  where: { userId },
  include: { meals: true },
});

if (!userMeal) {
  userMeal = await prisma.userMeal.create({
    data: { userId },
  });
}

// Create the meal with macronutrients
const savedMeal = await prisma.meal.create({
  data: {
    mealName,
    mealType,
    calories: parseInt(calories, 10),
    protein: parseFloat(protein),
    fat: parseFloat(fat),
    sugar: parseFloat(sugar),
    photoUrl,
    userMealId: userMeal.id,
  },
});

res.json(savedMeal);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save meal" });
  }
};
module.exports.getUserMeal = async (req, res) => {
  try {
    const userId = req.user.userId;

    const userMeal = await prisma.userMeal.findUnique({
      where: { userId },
      include: {
    meals: {
      include: {
        mealIngredients: {
          include: {
            ingredient: true, // <-- include the actual Ingredient object
          },
        },
      },
    },
  },
    });

    if (!userMeal) {
      return res.json({
        meals: [],
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalSugar: 0,
        calorieLimit: 0,
      });
    }

    res.json({
      meals: userMeal.meals,
      totalCalories: userMeal.totalCalories,
      totalProtein: userMeal.totalProtein,
      totalFat: userMeal.totalFat,
      totalSugar: userMeal.totalSugar,
      calorieLimit: userMeal.calorieLimit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user meals" });
  }
};

module.exports.consumeMeal = async (req, res) => {
  try {
    const mealId = parseInt(req.body.mealId, 10);
    const userId = req.user.userId;

    if (!mealId) return res.status(400).json({ error: "Missing mealId" });

    const meal = await prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) return res.status(404).json({ error: "Meal not found" });

    const userMeal = await prisma.userMeal.findUnique({ where: { userId } });
    if (!userMeal) return res.status(404).json({ error: "UserMeal not found" });

    // Increment all totals
    await prisma.userMeal.update({
      where: { id: userMeal.id },
      data: {
        totalCalories: { increment: meal.calories },
        totalProtein: { increment: meal.protein },
        totalFat: { increment: meal.fat },
        totalSugar: { increment: meal.sugar },
      },
    });

    res.json({ success: true, message: "Meal consumed!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to consume meal" });
  }
};


// Update calorie limit
module.exports.updateCalorieLimit = async (req, res) => {
  try {
    const { calorieLimit } = req.body;
    const userId = req.user.userId;

    let userMeal = await prisma.userMeal.findUnique({ where: { userId } });
    if (!userMeal) {
      userMeal = await prisma.userMeal.create({ data: { userId } });
    }

    const updated = await prisma.userMeal.update({
      where: { id: userMeal.id },
      data: { calorieLimit: parseInt(calorieLimit, 10) },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update calorie limit" });
  }
};
module.exports.getUserIntake = (req, res) => {
  const userId = req.user.userId;
  const period = req.query.period;

  try {
    if (period === "today") {
      prisma.userMeal
        .findUnique({
          where: { userId },
          select: { 
            totalCalories: true, 
            calorieLimit: true,
            totalSugar: true,
            totalFat: true,
            totalProtein: true
          },
        })
        .then((userMeal) => {
          res.json(userMeal || null);
        })
        .catch((err) =>
          res.status(500).json({ error: "Failed to fetch today's intake" })
        );
    } else if (period === "yesterday") {
      prisma.dailyIntake
        .findFirst({
          where: { userId },
          orderBy: { date: "desc" },
          select: { 
            totalCalories: true, 
            calorieLimit: true, 
            totalSugar: true,
            totalFat: true,
            totalProtein: true,
            date: true 
          },
        })
        .then((intake) => res.json(intake || null))
        .catch((err) =>
          res.status(500).json({ error: "Failed to fetch yesterday's intake" })
        );
    } else if (period === "weekly") {
      prisma.dailyIntake
        .findMany({
          where: { userId },
          orderBy: { date: "desc" },
          take: 7,
          select: { 
            totalCalories: true, 
            calorieLimit: true, 
            totalSugar: true,
            totalFat: true,
            totalProtein: true,
            date: true 
          },
        })
        .then((intake) => res.json(intake))
        .catch((err) =>
          res.status(500).json({ error: "Failed to fetch weekly intake" })
        );
    } else if (period === "monthly") {
      prisma.dailyIntake
        .findMany({
          where: { userId },
          orderBy: { date: "desc" },
          take: 30,
          select: { 
            totalCalories: true, 
            calorieLimit: true, 
            totalSugar: true,
            totalFat: true,
            totalProtein: true,
            date: true 
          },
        })
        .then((intake) => res.json(intake))
        .catch((err) =>
          res.status(500).json({ error: "Failed to fetch monthly intake" })
        );
    } else {
      res.status(400).json({ error: "Invalid period" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch intake" });
  }
};
module.exports.updateMeal = async (req, res) => {
  try {
    const mealId = parseInt(req.params.mealId, 10);

    if (!mealId) return res.status(400).json({ error: "Missing mealId" });

    const meal = await prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) return res.status(404).json({ error: "Meal not found" });

    // Only allow updating certain fields
    const { mealName, mealType, calories, protein, fat, sugar, photoUrl } = req.body;

   const updatedMeal = await prisma.meal.update({
  where: { id: mealId },
  data: {
    mealName,
    mealType,
    calories: Number(calories),
    protein: parseFloat(protein),
    fat: parseFloat(fat),
    sugar: parseFloat(sugar),
    photoUrl,
  },
});

    res.json({ success: true, message: "Meal updated!", meal: updatedMeal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update meal" });
  }
};


module.exports.deleteMeal = async (req, res) => {
  try {
    const mealId = parseInt(req.params.mealId, 10);

    if (!mealId) return res.status(400).json({ error: "Missing mealId" });

    const meal = await prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) return res.status(404).json({ error: "Meal not found" });

    await prisma.meal.delete({ where: { id: mealId } });

    res.json({ success: true, message: "Meal deleted!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete meal" });
  }
};
