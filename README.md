# web-app

ST0526 CICD Starter Project

## Getting Started

1. Procure 2 Postgres Database (e.g. from Neon DB), one would be used for development and the other for test environment
2. Create 2 `.env` file named `.env.development` and `.env.test` both with the following content:

   ```
   DATABASE_URL=
   PORT=
   ```

   2.1 `DATABASE_URL`: Paste the connection string for development and test environment into the `.env` files respectively.
   2.2 Set PORT to `3000` for `.env.development` and `3001` for `.env.test`

3. Install dependencies: `npm install`
4. Setup database: `npm run migrate:reset`
5. Start server: `npm start`
6. Run end-2-end test: `npm test`





## members
LIU TENG YU
ETHAN LIM
YEO JIA YAO LOUIS
AARON TEW JIA JING

## how to start

- Make sure to clear database first
- npm start
- register/login
- (For testing, node cron runs every 5 minutes instead of each day. Data viewed may not be accurate before changing node cron to accurately refresh daily instead of 5 minutes)
