const express = require('express');
const router = express.Router();
const {
  createSomething,
  getAllSomethings,
  updateSomething,
  deleteSomething,
} = require('../models/Something.model');

// Create a new something
router.post('/', (req, res, next) => {
  const { name } = req.body;
  createSomething(name)
    .then((something) => res.status(201).json(something))
    .catch(next);
});

// Retrieve all somethings
router.get('/', (req, res, next) => {
  getAllSomethings()
    .then((somethings) => res.status(200).json(somethings))
    .catch(next);
});

// Update a something
router.put('/:id', (req, res, next) => {
  const { id } = req.params;
  const data = req.body;
  updateSomething(parseInt(id), data)
    .then((something) => res.status(200).json(something))
    .catch(next);
});

// Delete a something
router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  deleteSomething(parseInt(id))
    .then((something) => res.status(200).json(something))
    .catch(next);
});

module.exports = router;
