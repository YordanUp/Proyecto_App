require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../src/models/Role');
const { PERMISSIONS } = require('../src/services/permissions');
const auditService = require('../src/services/auditService');
const { syncOperationalRoles } = require('./operationalRoleSync');

function parseMode(args) {
  const modes = args.filter(arg => arg === '--dry-run' || arg === '--apply');
  const unknown = args.filter(arg => !['--dry-run', '--apply'].includes(arg));
  if (unknown.length || modes.length !== 1) throw new Error('Uso: npm run db:seed-operational-roles -- --dry-run | --apply');
  return modes[0] === '--dry-run' ? 'dry-run' : 'apply';
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const { connectDatabase, disconnectDatabase } = require('../src/config/database');
  await connectDatabase();
  let session;
  try {
    let result;
    if (mode === 'apply') {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        result = await syncOperationalRoles({ RoleModel: Role, permissions: PERMISSIONS, mode, session, recordAudit: entry => auditService.recordAudit(entry) });
      });
    } else {
      result = await syncOperationalRoles({ RoleModel: Role, permissions: PERMISSIONS, mode });
    }
    console.info(JSON.stringify(result));
  } finally {
    if (session) await session.endSession();
    await disconnectDatabase();
  }
}

main().catch(async error => {
  console.error(JSON.stringify({ event: 'operational_roles_sync_failed', message: error.message }));
  if (mongoose.connection.readyState) await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
