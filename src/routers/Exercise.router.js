const express = require('express');
const router = express.Router();

const {
  getAllExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
} = require('../models/Exercise.model');

router.get('/', (req, res, next) => {
  getAllExercises(req.query)
    .then((exercises) => res.status(200).json(exercises))
    .catch(next);
});

router.get('/:id', (req, res, next) => {
  getExerciseById(req.params.id)
    .then((exercise) => {
      if (!exercise) {
        return res.status(404).json({ message: 'Exercise not found' });
      }
      res.status(200).json(exercise);
    })
    .catch(next);
});

router.post('/', (req, res, next) => {
  createExercise(req.body)
    .then((exercise) => res.status(201).json(exercise))
    .catch(next);
});

router.put('/:id', (req, res, next) => {
  updateExercise(req.params.id, req.body)
    .then((exercise) => res.status(200).json(exercise))
    .catch(next);
});

router.delete('/:id', (req, res, next) => {
  deleteExercise(req.params.id)
    .then(() => res.status(204).send())
    .catch(next);
});

module.exports = router;
