const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getUsers, getUser, createUserController, updateUserController, toggleStatus, changeRole } = require('../controllers/userController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['users.read']), getUsers);
router.get('/:id', authorize(['users.read']), getUser);
router.post('/', authorize(['users.create', 'users.assign_role']), createUserController);
router.put('/:id', authorize(['users.update']), updateUserController);
router.patch('/:id/status', authorize(['users.update']), toggleStatus);
router.patch('/:id/role', authorize(['users.update', 'users.assign_role', 'roles.read']), changeRole);

module.exports = router;
