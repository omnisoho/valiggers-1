const cronDisabled = String(process.env.STORE_TIMEOUT_CRON_DISABLED || '').toLowerCase() === 'true';

if (cronDisabled) {
  console.log('Store timeout cron disabled by env.');
} else if (!global.storeSessionTimeoutCronStarted) {
  global.storeSessionTimeoutCronStarted = true;

  const cron = require('node-cron');
  const { expireAllStoreSessions } = require('./Store.model');
  const cronExpr = process.env.STORE_TIMEOUT_CRON || '* * * * *';

  cron.schedule(cronExpr, async () => {
    try {
      const result = await expireAllStoreSessions();
      if (result.expiredCount > 0) {
        console.log(
          `[STORE_TIMEOUT] expired=${result.expiredCount} scannedUsers=${result.scannedUsers}`
        );
      }
    } catch (err) {
      console.error('[STORE_TIMEOUT] cron failed:', err?.message || err);
    }
  });

  console.log(`Store timeout cron started. schedule=${cronExpr}`);
} else {
  console.log('Store timeout cron already running. Skipping...');
}
