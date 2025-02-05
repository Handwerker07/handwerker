const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ShopCart = require('../models/ShopCart');
const Orders = require('../models/Orders');
const Item = require('../models/Item');
const Catalogue = require('../models/Catalogue'); // Import Catalogue model
const CustomOrders = require('../models/CustomOrders'); // Import the Catalogue model
const nodemailer = require('nodemailer');

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // App password from Google
    },
});

const multer = require('multer');
const upload = multer(); // No disk storage, keeps files in memory

// ================= User Routes =================
// Fetch all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update user details
router.put('/users/:id', async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ================= ShopCart Routes =================
// Fetch all shop carts
router.get('/shop-carts', async (req, res) => {
    try {
        const carts = await ShopCart.find();
        res.json(carts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete a cart
router.delete('/shop-carts/:id', async (req, res) => {
    try {
        await ShopCart.findByIdAndDelete(req.params.id);
        res.json({ message: 'Cart deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all orders with filters (e.g., status)
router.get("/orders", async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        // Build filter dynamically
        const filter = {};
        if (status) filter.status = status;

        // Fetch data from the database with populated item details
        const orders = await Orders.find(filter)
            .populate({
                path: "items.item",
                select: "name photos"
            })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const totalOrders = await Orders.countDocuments(filter);

        // Send proper response
        res.json({
            orders,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});


// Get details of a specific order by ID
router.get("/orders/:id", async (req, res) => {
    try {
        const order = await Orders.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch order details" });
    }
});


// Update the status of an order (approve, reject, cancel, etc.)
router.put("/orders/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        // Validate the status
        const validStatuses = [
            "Pending",
            "Approved",
            "Rejected",
            "Cancelled",
            "Delivery-ongoing",
            "Completed",
            "PaymentFailed"
        ];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        // Fetch the order to update
        const order = await Orders.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        // Fetch the user for email notifications and cart updates
        const user = await User.findById(order.user);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // If the payment failed, restore items to the cart
        if (status === "PaymentFailed") {
            let cart = await ShopCart.findOne({ user: user._id });

            if (!cart) {
                cart = new ShopCart({ user: user._id, items: [] });
            }

            order.items.forEach(orderItem => {
                const existingItem = cart.items.find(cartItem =>
                    cartItem.item.toString() === orderItem.item.toString()
                );

                if (existingItem) {
                    existingItem.quantity += orderItem.quantity; // Increase quantity if item exists
                } else {
                    cart.items.push({
                        item: orderItem.item,
                        quantity: orderItem.quantity,
                        priceAtPurchase: orderItem.priceAtPurchase
                    });
                }
            });

            await cart.save(); // Save updated cart
        }

        // If the status is set to "Completed", decrement stock and update sale count
        if (status === "Completed") {
            const items = order.items; // Assuming order.items is an array of { item, quantity }
            for (const entry of items) {
                const { item: itemId, quantity } = entry; // Extract item id and quantity
                const product = await Item.findById(itemId);
                if (!product) {
                    return res.status(404).json({ error: `Product with ID ${itemId} not found` });
                }
                if (product.stock < quantity) {
                    return res.status(400).json({ error: `Insufficient stock for item: ${product.name}` });
                }
                product.stock -= quantity;
                product.saleCount += quantity;
                await product.save();
            }
        }

        // Update the order status and updatedAt timestamp
        order.status = status;
        order.updatedAt = new Date();

        // Prepare embed text placeholders and set custom messages in the order document
        let emailText = "";
        switch (status) {
            case "Approved":
                order.approvalMessage = "Your order is approved! We’ve started crafting your furniture with care. 🛠️";
                order.rejectionMessage = "";
                order.deliveryMessage = "";
                order.completedMessage = "";
                emailText = `
Dear ${user.name},

Thank you for choosing The Handwerker!

We are pleased to inform you that your order (ID: #${order._id}) has been approved.
Our team is now preparing your items for dispatch and will keep you informed of any updates.

-------------------------------------
Order Summary:
Total Price: ₨${order.totalPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
-------------------------------------

If you have any questions or need further assistance, please do not hesitate to contact us:
📞 Phone: +230 5981 9835  
✉️ Email: thehandwerkerfurniture@gmail.com  
🌍 Website: www.thehandwerker.com

Thank you for your trust in us.

Warm regards,  
The Handwerker Team

-------------------------------------
The Handwerker © ${new Date().getFullYear()} | All Rights Reserved
`;
                break;
            case "Rejected":
                order.paymentMessage = "";
                order.rejectionMessage = "Unfortunately, your order has been rejected. Please contact support for details.";
                order.approvalMessage = "";
                order.deliveryMessage = "";
                order.completedMessage = "";
                emailText = "We regret to inform you that your order has been rejected. Please contact support.";
                break;
            case "PaymentFailed":
                order.paymentMessage = "⚠️ Your payment could not be verified. Please check your transaction ID and try again.";
                order.rejectionMessage = "";
                order.approvalMessage = "";
                order.deliveryMessage = "";
                order.completedMessage = "";
                emailText = `
Dear ${user.name},

We regret to inform you that your payment for order (ID: #${order._id}) has failed due to an invalid or incorrect transaction ID.

-------------------------------------
Payment Details:
Total Price: ₨${order.totalPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
Payment Method: ${order.paymentMethod}
Transaction ID: ${order.transactionId || "Not Provided"}
-------------------------------------

To complete your purchase, please ensure that you provide the correct transaction ID or retry the payment process, your selected products are added back to your cart

For any assistance, please reach out to us:
📞 Phone: +230 5981 9835  
✉️ Email: thehandwerkerfurniture@gmail.com  
🌍 Website: www.thehandwerker.com

We appreciate your patience and look forward to resolving this issue.

Sincerely,  
The Handwerker Team

-------------------------------------
The Handwerker © ${new Date().getFullYear()} | All Rights Reserved
`;
                break;
            case "Delivery-ongoing":
                order.paymentMessage = "";
                order.deliveryMessage = "Your order is on its way! 🚚 Expected delivery soon.";
                order.approvalMessage = "";
                order.rejectionMessage = "";
                order.completedMessage = "";
                break;
            case "Completed":
                order.paymentMessage = "";
                order.completedMessage = "🎉 Your order has been successfully delivered! Enjoy your purchase.";
                order.approvalMessage = "";
                order.rejectionMessage = "";
                order.deliveryMessage = "";
                emailText = `
Dear ${user.name},

We are pleased to inform you that your order (ID: #${order._id}) has been successfully completed and delivered to your door.
Below, please find your receipt details for your records.

-------------------------------------
Receipt Details:
Total Price: ₨${order.totalPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
-------------------------------------

We hope you enjoy your purchase. Should you have any queries or require additional support, our customer service team is here to help.

Thank you for shopping with The Handwerker. We look forward to serving you again in the future.

Sincerely,  
The Handwerker Team

-------------------------------------
The Handwerker © ${new Date().getFullYear()} | All Rights Reserved
`;
                break;
            default:
                order.paymentMessage = "";
                order.approvalMessage = "";
                order.rejectionMessage = "";
                order.deliveryMessage = "";
                order.completedMessage = "";
                break;
        }

        // Save the order with updated status and custom messages
        await order.save();

        // Send email notifications based on status (if applicable)
        if (emailText && (status === "Approved" || status === "Completed" || status === "Rejected" || status === "PaymentFailed")) {
            const subject = status === "Approved" ? "Your Order Has Been Approved" :
                status === "Completed" ? "Your Order Receipt" :
                    status === "PaymentFailed" ? "Payment Failed - Action Required" :
                        "Your Order Has Been Rejected";
            const mailOptions = {
                from: `"The Handwerker" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: subject,
                text: emailText,
            };
            await transporter.sendMail(mailOptions);
        }

        res.json({ message: "Order status updated", order });
    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(500).json({ error: "Failed to update order status" });
    }
});



// Delete an order (if needed)
router.delete("/orders/:id", async (req, res) => {
    try {
        const order = await Orders.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json({ message: "Order deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete order" });
    }
});

// ================= Item Routes =================
// Fetch all items
router.get('/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Fetch a single item by ID
router.get('/items/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new item with image data stored as binary
router.post(
    '/items',
    upload.fields([
        { name: 'photo1', maxCount: 1 },
        { name: 'photo2', maxCount: 1 },
        { name: 'photo3', maxCount: 1 },
        { name: 'photo4', maxCount: 1 },
        { name: 'photo5', maxCount: 1 },
        { name: 'photo6', maxCount: 1 },
        { name: 'photo7', maxCount: 1 },
        { name: 'photo8', maxCount: 1 },
        { name: 'photo9', maxCount: 1 },
        { name: 'photo10', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const {
                name,
                description,
                price,
                stock,
                category,
                subcategory,
            } = req.body;

            // Check if `details` is provided, assign default if not
            const details = req.body.details && req.body.details.trim()
                ? req.body.details
                : 'No Details Provided for this product';

            // Initialize an empty array to store photos
            const photos = [];

            // Loop through each field in req.files
            for (let fieldName in req.files) {
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    const file = req.files[fieldName][0]; // Access the uploaded file
                    photos.push({
                        data: file.buffer, // Binary data
                        contentType: file.mimetype, // MIME type
                    });
                }
            }

            // Create a new item in the database
            const newItem = new Item({
                name,
                description,
                details, // Default or user-provided details
                price,
                stock,
                category,
                subcategory,
                photos, // Array of photo objects
            });

            await newItem.save();
            res.json({ message: 'Item added successfully.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to add item.' });
        }
    }
);

// Update an existing item and replace photos
router.put('/items/:id', upload.array('photos', 10), async (req, res) => {
    try {
        const { name, description, details, price, offer, stock, category, subcategory } = req.body;

        // Collect uploaded photos from the request, if any
        const photos = req.files.map((file) => ({
            data: file.buffer,
            contentType: file.mimetype,
        }));

        // Update the item
        const updatedItem = await Item.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description,
                details,
                price,
                offer,
                stock,
                category,
                subcategory,
                ...(photos.length > 0 && { photos }), // Only update photos if provided
            },
            { new: true }
        );

        res.json(updatedItem);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update item.' });
    }
});
// Delete an item
router.delete('/items/:id', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add a new catalogue with an optional photo
router.post('/catalogues', upload.single('photo'), async (req, res) => {
    try {
        const { name, link } = req.body;

        // Prepare the photo data if uploaded
        const photo = req.file
            ? { data: req.file.buffer, contentType: req.file.mimetype }
            : null;

        // Create a new catalogue entry
        const newCatalogue = new Catalogue({ name, link, photo });

        await newCatalogue.save();
        res.json({ message: 'Catalogue added successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to add catalogue.' });
    }
});

// Update an existing catalogue using ID or link
router.put('/catalogues', upload.single('photo'), async (req, res) => {
    try {
        const { id, link, name } = req.body;

        if (!id && !link) {
            return res.status(400).json({ message: 'ID or link is required to update a catalogue.' });
        }

        const filter = id ? { _id: id } : { link };

        // Prepare the photo data if uploaded
        const photo = req.file
            ? { data: req.file.buffer, contentType: req.file.mimetype }
            : null;

        // Construct update object
        const updateData = {};
        if (name) updateData.name = name;
        if (photo) updateData.photo = photo;

        const updatedCatalogue = await Catalogue.findOneAndUpdate(filter, updateData, { new: true });

        if (!updatedCatalogue) {
            return res.status(404).json({ message: 'Catalogue not found.' });
        }

        res.json(updatedCatalogue);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update catalogue.' });
    }
});

// Delete a catalogue using ID or link
router.delete('/catalogues', async (req, res) => {
    try {
        const { id, link } = req.body;

        if (!id && !link) {
            return res.status(400).json({ message: 'ID or link is required to delete a catalogue.' });
        }

        const filter = id ? { _id: id } : { link };

        const deletedCatalogue = await Catalogue.findOneAndDelete(filter);

        if (!deletedCatalogue) {
            return res.status(404).json({ message: 'Catalogue not found.' });
        }

        res.json({ message: 'Catalogue deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to delete catalogue.' });
    }
});

// GET: Fetch all orders (latest first)
router.get('/customorders', async (req, res) => {
    try {
        const orders = await CustomOrders.find().sort({ submittedAt: -1 }); // Sort by createdAt in descending order
        return res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ error: 'An error occurred while fetching orders.' });
    }
});

// DELETE: Delete a specific order by ID
router.delete('/customorders/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedOrder = await CustomOrders.findByIdAndDelete(id);

        if (!deletedOrder) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        return res.status(200).json({ message: 'Order deleted successfully!', order: deletedOrder });
    } catch (error) {
        console.error('Error deleting order:', error);
        return res.status(500).json({ error: 'An error occurred while deleting the order.' });
    }
});

module.exports = router;
