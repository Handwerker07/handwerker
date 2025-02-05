const express = require('express');
const router = express.Router();
const Order = require('../models/Orders');
const ShopCart = require('../models/ShopCart');
const { ensureAuthenticated } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Main profile route - show account management with initial overview section
router.get('/', ensureAuthenticated, async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).populate('items.item');

    const section = req.query.tab || 'overview'; // Default to 'overview'
    try {
        // Fetch data
        const ongoingOrders = await Order.find({ user: req.user._id, status: { $ne: 'completed' } }).populate('items.item');
        const completedOrders = await Order.find({ user: req.user._id, status: 'completed' }).populate('items.item');
        const cart = await ShopCart.findOne({ user: req.user._id }).populate('items.item');

        // Sort orders: non-completed first, then completed, and sort by creation date (newest first)
        orders.sort((a, b) => {
            if (a.status === 'Completed' && b.status !== 'Completed') return 1; // Move completed to bottom
            if (a.status !== 'Completed' && b.status === 'Completed') return -1; // Keep non-completed at top
            return new Date(b.createdAt) - new Date(a.createdAt); // Sort by newest first
        });


        // Load categories from categories.json
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        // Render profile page
        res.render('profile', {
            user: req.user,
            ongoingOrders,
            completedOrders,
            cart,
            section,
            categories,
            orders
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not load profile information');
        res.redirect('/');
    }
});

router.post('/settings', ensureAuthenticated, async (req, res) => {
    try {
        const { name, gender, dob, password } = req.body;

        // Find the user by ID
        const user = await User.findById(req.user._id);

        // Update fields
        user.name = name;
        user.gender = gender;
        user.dob = dob;

        // Update password if provided
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        // Save updated user
        await user.save();

        req.flash('success', 'Profile updated successfully!');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update profile. Please try again.');
        res.redirect('/profile/settings');
    }
});


module.exports = router;
