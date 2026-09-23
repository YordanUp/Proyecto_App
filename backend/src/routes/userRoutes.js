const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getUsers, getUser, createUserController, updateUserController, toggleStatus, changeRole } = require('../controllers/userController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['users:read']), getUsers);
router.get('/:id', authorize(['users:read']), getUser);
router.post('/', authorize(['users:write']), createUserController);
router.put('/:id', authorize(['users:write']), updateUserController);
router.patch('/:id/status', authorize(['users:write']), toggleStatus);
router.patch('/:id/role', authorize(['users:write']), changeRole);

module.exports = router;
