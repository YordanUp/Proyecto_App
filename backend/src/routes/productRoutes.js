const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getProducts, createProductController } = require('../controllers/catalogController');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(['products:read']), getProducts);
router.post('/', authorize(['products:write']), createProductController);

module.exports = router;
