const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getCategories, getCategory, createCategoryController, updateCategory, deleteCategory } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['categories.read']), getCategories);
router.post('/', authorize(['categories.create']), createCategoryController);
router.get('/:id', authorize(['categories.read']), getCategory);
router.put('/:id', authorize(['categories.update']), updateCategory);
router.delete('/:id', authorize(['categories.delete']), deleteCategory);

module.exports = router;
