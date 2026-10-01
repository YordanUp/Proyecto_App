const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const { PERMISSIONS } = require('./permissions');
const auditService = require('./auditService');
const { hashPassword } = require('./authService');

function validateBootstrapEnvironment(env) {
  const name = env.INITIAL_ADMIN_NAME?.trim();
  const email = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!name || !email || !password) {
    throw new Error('Faltan INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL o INITIAL_ADMIN_PASSWORD');
  }
  if (name.length < 2 || name.length > 120) throw new Error('INITIAL_ADMIN_NAME no es válido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('INITIAL_ADMIN_EMAIL no es válido');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres y no superar 72 bytes');
  }
  return { name, email, password };
}

function queryInSession(query, session) {
  return query.session(session);
}

async function ensureInitialAdmin(env = process.env) {
  if (mongoose.connection.readyState !== 1) throw new Error('MongoDB debe estar conectado antes de crear el administrador inicial');

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      let role = await queryInSession(Role.findOne({ name: 'admin' }), session);
      if (role) {
        const existingAdmin = await queryInSession(User.findOne({ role: role._id }), session);
        if (existingAdmin) {
          result = { created: false };
          return;
        }
      }

      const { name, email, password } = validateBootstrapEnvironment(env);
      const existingEmail = await queryInSession(User.findOne({ email }), session);
      if (existingEmail) throw new Error('INITIAL_ADMIN_EMAIL ya pertenece a otro usuario; no se modificó ninguna cuenta');

      if (!role) {
        [role] = await Role.create([{
          name: 'admin',
          description: 'Administrador inicial',
          permissions: PERMISSIONS,
          isSystem: true
        }], { session });
        await auditService.recordAudit({
          action: 'bootstrap',
          module: 'roles',
          recordId: role.id,
          after: { name: 'admin', isSystem: true },
          session
        });
      } else {
        if (!role.isSystem) throw new Error('El rol admin existente no es de sistema; requiere revisión manual');
        const rolePermissions = new Set(role.permissions);
        if (PERMISSIONS.some(permission => !rolePermissions.has(permission))) {
          throw new Error('El rol admin existente no tiene los permisos requeridos; requiere revisión manual');
        }
      }

      const [user] = await User.create([{
        name,
        email,
        passwordHash: await hashPassword(password),
        role: role._id,
        status: 'active',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }], { session });
      await auditService.recordAudit({
        userId: user.id,
        action: 'bootstrap',
        module: 'users',
        recordId: user.id,
        after: { roleId: role.id, status: 'active' },
        session
      });
      result = { created: true };
    });
  } catch (error) {
    // Concurrent service starts can race on unique role/email indexes. Treat it
    // as success only if the transaction winner left an administrator behind.
    if (error.code === 11000) {
      const role = await Role.findOne({ name: 'admin' });
      const existingAdmin = role && await User.findOne({ role: role._id });
      if (existingAdmin) result = { created: false };
      else throw error;
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  console.info(result.created ? 'Administrador inicial creado' : 'Administrador inicial ya existe; bootstrap omitido');
  return result;
}

module.exports = { ensureInitialAdmin, validateBootstrapEnvironment };
