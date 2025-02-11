const router = require('express').Router();
const todoStore = require('../store/todoStore');

router.get('/', (req, res) => res.json(todoStore.getAll()));
router.post('/', (req, res) => res.json(todoStore.add(req.body)));
router.put('/:id', (req, res) => res.json(todoStore.update(req.params.id, req.body)));
router.delete('/:id', (req, res) => res.json(todoStore.delete(req.params.id)));

module.exports = router; 