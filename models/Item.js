const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
    data: Buffer,
    contentType: String,
});

// Define the schema for items
const itemSchema = new mongoose.Schema({
    name: String,
    description: String,
    details: {
        type: String,
        default: "Details are not provided"
    },
    price: Number,
    stock: Number,
    saleCount: {
        type: Number,
        default: 0,
        require: true
    },
    offer: {
        type: Number,
        default: 0,
        require: true
    },
    photos: [PhotoSchema], // Array of photo objects
    category: {
        type: String,
        required: true
    },
    subcategory: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
