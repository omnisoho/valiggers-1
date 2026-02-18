const express = require('express');
const router = express.Router();

const {
  getAllCategories,
  createCategory,
} = require('../models/ResourceCategory.model');

router.get('/', async (req, res, next) => {
  getAllCategories()
    .then((categories) => res.status(200).json(categories))
    .catch(next);
});

router.post('/', async (req, res, next) => {
  createCategory(req.body)
    .then((category) => res.status(201).json(category))
    .catch(next);
});

module.exports = router;