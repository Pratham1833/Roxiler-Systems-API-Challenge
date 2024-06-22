const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  id: Number,
  title: String,
  description: String,
  price: Number,
  dateOfSale: Date,
  category: String,
  sold: Boolean,
});

module.exports = mongoose.model('Transaction', TransactionSchema);
