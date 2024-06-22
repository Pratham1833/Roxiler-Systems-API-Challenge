const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors'); // Import cors

const app = express();
const port = 5000;

// Enable CORS
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mern-challenge', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const transactionSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  dateOfSale: String,
  sold: Boolean,
  category: String,
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Seed database
app.get('/api/init/seed', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const transactions = response.data;

    await Transaction.deleteMany({});
    await Transaction.insertMany(transactions);

    res.status(200).send('Database seeded successfully');
  } catch (error) {
    res.status(500).send('Error seeding database');
  }
});

// Transactions API
app.get('/api/transactions', async (req, res) => {
  const { month, search, page = 1, perPage = 10 } = req.query;

  const query = {
    dateOfSale: { $regex: `-${month}-`, $options: 'i' },
  };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { price: { $regex: search, $options: 'i' } },
    ];
  }

  const transactions = await Transaction.find(query)
    .skip((page - 1) * perPage)
    .limit(parseInt(perPage));

  res.json(transactions);
});

// Statistics API
app.get('/api/transactions/statistics', async (req, res) => {
  const { month } = req.query;

  const query = {
    dateOfSale: { $regex: `-${month}-`, $options: 'i' },
  };

  const totalSaleAmount = await Transaction.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const totalSoldItems = await Transaction.countDocuments({ ...query, sold: true });
  const totalNotSoldItems = await Transaction.countDocuments({ ...query, sold: false });

  res.json({
    totalSaleAmount: totalSaleAmount[0]?.total || 0,
    totalSoldItems,
    totalNotSoldItems,
  });
});

// Bar Chart API
app.get('/api/transactions/barchart', async (req, res) => {
  const { month } = req.query;

  const query = {
    dateOfSale: { $regex: `-${month}-`, $options: 'i' },
  };

  const priceRanges = [
    [0, 100],
    [101, 200],
    [201, 300],
    [301, 400],
    [401, 500],
    [501, 600],
    [601, 700],
    [701, 800],
    [801, 900],
    [901, Infinity],
  ];

  const barChartData = await Promise.all(
    priceRanges.map(async ([min, max]) => {
      const count = await Transaction.countDocuments({
        ...query,
        price: { $gte: min, $lt: max },
      });

      return {
        range: [min, max === Infinity ? 'above' : max],
        count,
      };
    })
  );

  res.json(barChartData);
});

// Pie Chart API
app.get('/api/transactions/piechart', async (req, res) => {
  const { month } = req.query;

  const query = {
    dateOfSale: { $regex: `-${month}-`, $options: 'i' },
  };

  const pieChartData = await Transaction.aggregate([
    { $match: query },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $project: { category: '$_id', count: 1, _id: 0 } },
  ]);

  res.json(pieChartData);
});

// Combined API
app.get('/api/transactions/all', async (req, res) => {
  const { month } = req.query;

  const [transactions, statistics, barChartData, pieChartData] = await Promise.all([
    Transaction.find({ dateOfSale: { $regex: `-${month}-`, $options: 'i' } }),
    Transaction.aggregate([
      { $match: { dateOfSale: { $regex: `-${month}-`, $options: 'i' } } },
      { $group: { _id: null, total: { $sum: '$price' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { dateOfSale: { $regex: `-${month}-`, $options: 'i' } } },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
          default: 'Other',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { dateOfSale: { $regex: `-${month}-`, $options: 'i' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    transactions,
    statistics: statistics[0],
    barChartData,
    pieChartData,
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
