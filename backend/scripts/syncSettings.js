require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const settingsService = require('../src/services/settingsService');

function parseMode(args) {
  const modes = args.filter(arg => arg === '--dry-run' || arg === '--apply');
  const unknown = args.filter(arg => !['--dry-run', '--apply'].includes(arg));
  if (unknown.length || modes.length !== 1) throw new Error('Uso: npm run db:sync-settings -- --dry-run | --apply');
  return modes[0] === '--dry-run' ? 'dry-run' : 'apply';
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  await connectDatabase();
  let session;
  try {
    if (mode === 'apply') session = await mongoose.startSession();
    let result;
    if (session) {
      await session.withTransaction(async () => { result = await settingsService.bootstrapSettings({ mode, session }); });
    } else result = await settingsService.bootstrapSettings({ mode });
    console.info(JSON.stringify(result));
  } finally {
    if (session) await session.endSession();
    await disconnectDatabase();
  }
}

main().catch(async error => {
  console.error(JSON.stringify({ event: 'settings_sync_failed', message: error.message }));
  if (mongoose.connection.readyState) await disconnectDatabase().catch(() => {});
  process.exitCode = 1;
});
