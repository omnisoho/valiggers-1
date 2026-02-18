// Prevent duplicate cron jobs
if (!global.dailyIntakeCronStarted) {
  global.dailyIntakeCronStarted = true;

  const cron = require('node-cron');
  const prisma = require('./prismaClient');

  cron.schedule('0 */2 * * *', async () => {
    console.log("Cron running from single instance");

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const userMeals = await prisma.userMeal.findMany();

      for (const userMeal of userMeals) {
        await prisma.dailyIntake.create({
          data: {
            userId: userMeal.userId,
            date: today,
            totalCalories: userMeal.totalCalories,
            totalProtein: userMeal.totalProtein,
            totalFat: userMeal.totalFat,
            totalSugar: userMeal.totalSugar,
            calorieLimit: userMeal.calorieLimit
          }
        });
      }

      await prisma.userMeal.updateMany({
        data: {
          totalCalories: 0,
          totalProtein: 0,
          totalFat: 0,
          totalSugar: 0
        }
      });

    } catch (err) {
      console.error(err);
    }
  });

  console.log("Cron started.");
} else {
  console.log("Cron already running. Skipping...");
}
