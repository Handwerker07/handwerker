const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
    trim: true,
  },
  lastname: {
    type: String,
    required: true,
    trim: true,
  },
  subject: {
    type: String,
    required: false,
  },
  phonenumber: {
    type: String,
    required: false,
    match: /^[0-9]{10,15}$/, // Validates phone number length
  },
  email: {
    type: String,
    required: true,
    trim: true,
    match: /^\S+@\S+\.\S+$/, // Validates email format
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["Custom-Furniture", "Contact-Us"], // Defines allowed types
    required: true,
  },
  gmailThreadId: {
    type: String, // Stores the Gmail thread ID to track responses
    default: null,
  },
  submittedAt: {
    type: Date,
    default: Date.now, // Automatically adds the submission date
  },
});

module.exports = mongoose.model('CustomerOrders', orderSchema);
