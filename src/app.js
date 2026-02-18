const express = require('express');
const createError = require('http-errors');
const path = require('path');

const somethingRouter = require('./routers/Something.router');
const personRouter = require('./routers/Person.router');
const workoutRouter = require('./routers/Workout.router');
const ResourceRouter = require('./routers/Resource.router');
const resourceCategoryRouter = require('./routers/ResourceCategory.router');
const userRouter = require("./routers/userRoutes");
const nutritionRouter = require('./routers/nutrition.router')
const profileRoutes = require('./routers/profileRoutes');
const profileNotesRoutes = require('./routers/profileNotesRoutes');
const storeRouter = require('./routers/Store.router');
const paymentRouter = require('./routers/Payment.router');
const challengeRouter = require('./routers/Challenge.router');
const rewardsRouter = require('./routers/Rewards.router');

//CA2 grocery list
const GroceryRoute = require('./routers/Grocery.router')
const authMiddleware = require("./middlewares/authMiddleware");
const presetRouter = require("./routers/Preset.router");
const weeklyPlanRouter = require("./routers/WeeklyPlan.router");
const statsRouter = require("./routers/Stats.router");
const exerciseRouter = require('./routers/Exercise.router');
const sessionRouter = require("./routers/Session.router");
const coachRouter = require("./routers/Coach.router");
const tempSeedRouter = require('./routers/tempSeed.route');
const bookingRouter = require("./routers/Booking.router");
const chatRouter = require("./routers/Chat.router");

const app = express();

app.use(express.json());

// Serve uploads folder
app.use('/uploads', express.static('uploads'));//nutrition Tracker change

app.use(express.static(path.join(__dirname, 'public')));

// 2️⃣ YOUR ROUTERS
app.use('/somethings', somethingRouter);
app.use('/persons', personRouter);

app.use('/workouts-api', workoutRouter);
app.use('/nutrition', nutritionRouter);//nutrition Tracker change

//CA2 grocery list route
app.use('/grocery', GroceryRoute);//nutrition Tracker change


// Presets API (authenticated)
app.use("/presets-api", authMiddleware, presetRouter);

// Weekly plan API (authenticated)
app.use("/weekplan-api", authMiddleware, weeklyPlanRouter);

// Stats API (public or authenticated — both okay)
app.use("/stats-api", statsRouter);


app.use("/sessions-api", authMiddleware, sessionRouter);

//Store API
app.use('/api/store', storeRouter);
app.use('/api/payment', paymentRouter);

// Challenges API (authenticated)
app.use('/challenges-api', authMiddleware, challengeRouter);

// Rewards API (authenticated)
app.use('/rewards-api', authMiddleware, rewardsRouter);

// 3️⃣ YOUR HTML ROUTES
app.get('/workout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'workOutTracker.html'));
});
app.get('/workouts', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'workouts.html'));
});
app.get('/plans', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'plans.html'));
});
app.get('/stats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});
app.get("/sessions", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sessions.html"));
});

app.get('/challenges', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'challenges.html'));
});

// rewards page removed; rewards are shown inside Challenges page

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/coaches-page', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coaches.html'));
});

app.get('/coach-detail', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coach-detail.html'));
});

app.get('/how-it-works', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'how-it-works.html'));
});

app.get('/coach-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coach-register.html'));
});

app.get('/.well-known/*', (req, res) => res.status(204).end());
app.use('/resources', ResourceRouter);
app.use('/resource-categories', resourceCategoryRouter);
app.use('/exercises', exerciseRouter);
app.use("/coaches", coachRouter);
if (process.env.NODE_ENV !== "production") {
  app.use("/api/temp", tempSeedRouter);
}
app.use("/bookings", bookingRouter);
app.use("/chat", chatRouter);

// Louis' Routes
app.use("/api/users", userRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/notes', profileNotesRoutes);



// load cron jobs
require('./models/ResetCalories');
require('./models/StoreSessionTimeout');


// 4️⃣ 404 HANDLER — MUST BE LAST
app.use((req, res, next) => {
  if (req.originalUrl === '/favicon.ico') return res.status(204).end();
  next(createError(404, `Unknown resource ${req.method} ${req.originalUrl}`));
});

// 5️⃣ ERROR HANDLER
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message });
});

// ...
module.exports = app;
