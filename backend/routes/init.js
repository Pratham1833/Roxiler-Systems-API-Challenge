const express = require('express');
const axios = require('axios');
const Transaction = require('../models/Transaction');

const router = express.Router();

router.get('/seed', async (req, res) => {
  try {
    const { data } = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    await Transaction.deleteMany({});
    await Transaction.insertMany(data);
    res.send({ message: 'Database seeded successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Failed to seed database' });
  }
});

module.exports = router;
