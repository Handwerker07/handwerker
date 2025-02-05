const mongoose = require('mongoose');

// Define the schema for cart items
const cartItemSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',  // Reference to the Item model
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    priceAtPurchase: { 
        type: Number,
        required: true
    }
});

// Define the schema for the shopping cart
const shopCartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',  // Reference to the User model (assuming you have a User model)
        required: true
    },
    items: [cartItemSchema],  // Array of cart items
    totalPrice: {
        type: Number,
        required: true,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to calculate the total price of the cart
shopCartSchema.pre('save', function(next) {
    let total = 0;
    this.items.forEach(item => {
        total += item.priceAtPurchase * item.quantity;  // Calculate total price
    });
    this.totalPrice = total;
    next();
});

const ShopCart = mongoose.model('ShopCart', shopCartSchema);

module.exports = ShopCart;
