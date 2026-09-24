require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../src/config/config');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Role = require('../src/models/Role');
const User = require('../src/models/User');
const { PERMISSIONS } = require('../src/services/permissions');
const { recordAudit } = require('../src/services/auditService');
const { hashPassword } = require('../src/services/authService');

async function main() {
  const name = process.env.INITIAL_ADMIN_NAME;
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!name || !email || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Define INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD (mínimo 12 caracteres y máximo 72 bytes)');
  await connectDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let role = await Role.findOne({ name: 'admin' }).session(session);
      if (!role) [role] = await Role.create([{ name: 'admin', description: 'Administrador inicial', permissions: PERMISSIONS, isSystem: true }], { session });
      else {
        if (!role.isSystem) throw new Error('Ya existe un rol admin no protegido; revísalo manualmente antes de crear la cuenta inicial');
        role.permissions = PERMISSIONS;
        await role.save({ session });
      }
      let user = await User.findOne({ email }).session(session);
      if (user) throw new Error('Ya existe un usuario con INITIAL_ADMIN_EMAIL');
      [user] = await User.create([{ name, email, passwordHash: await hashPassword(password), role: role._id }], { session });
      await recordAudit({ userId: user.id, action: 'bootstrap', module: 'roles', recordId: role.id, after: { name: role.name, permissions: role.permissions }, session });
      await recordAudit({ userId: user.id, action: 'bootstrap', module: 'users', recordId: user.id, after: { name: user.name, email: user.email, roleId: role.id }, session });
      console.log(`Administrador inicial creado: ${user.email}`);
    });
  } finally { await session.endSession(); await disconnectDatabase(); }
}

main().catch(async error => { console.error(error.message); if (mongoose.connection.readyState) await disconnectDatabase(); process.exitCode = 1; });
