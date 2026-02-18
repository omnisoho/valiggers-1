const express = require('express');
const router = express.Router();

const {
  getAllResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource
} = require('../models/Resource.model');

router.get('/', async (req, res, next) => {
  getAllResources(req.query)
    .then((resources) => res.status(200).json(resources))
    .catch(next);
});

router.get('/:id', async (req, res, next) => {
  getResourceById(req.params.id)
    .then((resource) => {
      if (!resource) return res.status(404).json({ message: 'Resource not found' });
      res.status(200).json(resource);
    })
    .catch(next);
});

router.post('/', async (req, res, next) => {
  createResource(req.body)
    .then((resource) => res.status(201).json(resource))
    .catch(next);
});

router.put('/:id', async (req, res, next) => {
  updateResource(req.params.id, req.body)
    .then((resource) => res.status(200).json(resource))
    .catch(next);
});

router.delete('/:id', async (req, res, next) => {
  deleteResource(req.params.id)
    .then(() => res.status(204).send())
    .catch(next);
});

module.exports = router;