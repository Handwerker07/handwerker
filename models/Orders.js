const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',  // Reference to the User model
        required: true
    },
    items: [
        {
            item: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'Item',  // Reference to the Item model 
                required: true 
            },
            quantity: { type: Number, required: true },
            priceAtPurchase: { type: Number, required: true }
        }
    ],
    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'PaymentFailed', 'Rejected', 'Delivery-ongoing', 'Delivered', 'Cancelled', 'Completed'],
        default: 'Pending'
    },
    paymentMethod: { type: String, enum: ['bank', 'cod'], default: 'bank' },
    transactionId: { type: String, default: "" },
    // Custom messages for various order statuses:
    approvalMessage: { type: String, default: "" },
    rejectionMessage: { type: String, default: "" },
    deliveryMessage: { type: String, default: "" },
    completedMessage: { type: String, default: "" },
    paymentMessage: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

// Check if the order can be canceled by the user (only if status is 'Pending' or 'Approved')
orderSchema.methods.canBeCanceled = function() {
    return this.status === 'Pending' || this.status === 'Approved';
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
