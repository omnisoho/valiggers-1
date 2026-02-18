const { execSync } = require('child_process');

module.exports = async () => {
  // Set environment to 'test' and load .env.test
  console.log('Setting environment to test');

  // Run Prisma migration for the test database
  console.log('Running migrations for test environment...');
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
};
