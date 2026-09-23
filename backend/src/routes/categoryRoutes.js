const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getCategories, createCategoryController } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['categories:read']), getCategories);
router.post('/', authorize(['categories:write']), createCategoryController);

module.exports = router;
