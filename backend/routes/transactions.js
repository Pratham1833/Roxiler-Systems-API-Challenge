const express = require('express');
const Transaction = require('../models/Transaction');

const router = express.Router();

const getMonthCondition = (month) => {
  const startDate = new Date(`2021-${month}-01`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return { dateOfSale: { $gte: startDate, $lt: endDate } };
};

// List transactions with search and pagination
router.get('/', async (req, res) => {
  const { month, page = 1, perPage = 10, search = '' } = req.query;
  const query = {
    ...getMonthCondition(month),
    $or: [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { price: { $regex: search, $options: 'i' } },
    ],
  };

  const transactions = await Transaction.find(query)
    .skip((page - 1) * perPage)
    .limit(parseInt(perPage));
  res.send(transactions);
});

// Get statistics
router.get('/statistics', async (req, res) => {
  const { month } = req.query;
  const monthCondition = getMonthCondition(month);

  const totalSaleAmount = await Transaction.aggregate([
    { $match: monthCondition },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const soldItems = await Transaction.countDocuments({ ...monthCondition, sold: true });
  const notSoldItems = await Transaction.countDocuments({ ...monthCondition, sold: false });

  res.send({
    totalSaleAmount: totalSaleAmount[0]?.total || 0,
    soldItems,
    notSoldItems,
  });
});

// Get bar chart data
router.get('/barchart', async (req, res) => {
  const { month } = req.query;
  const monthCondition = getMonthCondition(month);

  const ranges = [
    { min: 0, max: 100 },
    { min: 101, max: 200 },
    { min: 201, max: 300 },
    { min: 301, max: 400 },
    { min: 401, max: 500 },
    { min: 501, max: 600 },
    { min: 601, max: 700 },
    { min: 701, max: 800 },
    { min: 801, max: 900 },
    { min: 901, max: Infinity },
  ];

  const result = await Promise.all(
    ranges.map(async (range) => {
      const count = await Transaction.countDocuments({
        ...monthCondition,
        price: { $gte: range.min, $lte: range.max },
      });
      return { range: `${range.min}-${range.max}`, count };
    })
  );

  res.send(result);
});

// Get pie chart data
router.get('/piechart', async (req, res) => {
  const { month } = req.query;
  const monthCondition = getMonthCondition(month);

  const categories = await Transaction.aggregate([
    { $match: monthCondition },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  res.send(categories.map((category) => ({ category: category._id, count: category.count })));
});

// Get combined data
router.get('/combined', async (req, res) => {
  const { month } = req.query;

  const [transactions, statistics, barChart, pieChart] = await Promise.all([
    Transaction.find(getMonthCondition(month)),
    Transaction.aggregate([
      { $match: getMonthCondition(month) },
      { $group: { _id: null, total: { $sum: '$price' }, sold: { $sum: { $cond: ['$sold', 1, 0] } } } },
    ]),
    (async () => {
      const ranges = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: Infinity },
      ];
      return Promise.all(
        ranges.map(async (range) => {
          const count = await Transaction.countDocuments({
            ...getMonthCondition(month),
            price: { $gte: range.min, $lte: range.max },
          });
          return { range: `${range.min}-${range.max}`, count };
        })
      );
    })(),
    Transaction.aggregate([
      { $match: getMonthCondition(month) },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  res.send({
    transactions,
    statistics: statistics[0] || { total: 0, sold: 0, notSold: 0 },
    barChart,
    pieChart: pieChart.map((category) => ({ category: category._id, count: category.count })),
  });
});

module.exports = router;
