const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getRoles, getRole, createRoleController } = require('../controllers/roleController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['roles:read']), getRoles);
router.get('/:id', authorize(['roles:read']), getRole);
router.post('/', authorize(['roles:write']), createRoleController);

module.exports = router;
