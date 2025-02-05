const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // App password from Google
    },
});

// Store reset codes temporarily (You can use a database for production)
const resetCodes = {};

// Forgot password - Request reset code
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ error: 'Email not found' });
    }

    // Generate a random 6-digit reset code
    const resetCode = crypto.randomInt(100000, 999999).toString();
    resetCodes[email] = resetCode; // Store temporarily

    // Send email with reset code
    const mailOptions = {
        from: `"The Handwerker" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Code',
        text: `Your password reset code is: ${resetCode}\n\nEnter this code to reset your password.`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: 'A reset code has been sent to your email.' });
});

// Verify reset code & update password
router.post('/reset-password', async (req, res) => {
    const { email, resetCode, newPassword } = req.body;

    if (resetCodes[email] !== resetCode) {
        return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.password = newPassword; // Make sure to hash the password in production!
    await user.save();

    delete resetCodes[email]; // Remove the used code
    res.json({ success: 'Password has been reset. You can now log in.' });
});

// Signup page route
router.get('/signup', (req, res) => {
    // If the user is already logged in, redirect to home
    if (req.session.user) {
        return res.redirect('/');
    }

    // Load categories from categories.json
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render('signup', { user: req.user, categories });
});

// Signup POST route
router.post('/signup', async (req, res) => {
    const { name, email, password, day, month, year } = req.body;

    // Basic form validation
    if (!name || !email || !password || !day || !month || !year) {
        req.flash('error', 'Please fill in all fields');
        return res.redirect('/auth/signup');
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        req.flash('error', 'Email already exists');
        return res.redirect('/auth/signup');
    }

    // Create new user with DOB
    const dob = new Date(`${year}-${month}-${day}`); // Create date from input
    const newUser = new User({
        name,
        email,
        role: 'user',
        password,
        dob // Store Date of Birth
    });

    await newUser.save();

    req.flash('success', 'Account created! You can now login.');
    res.redirect('/auth/login');
});

// Login page route
router.get('/login', (req, res) => {
    // If the user is already logged in, redirect to home
    if (req.session.user) {
        return res.redirect('/');
    }

    // Load categories from categories.json
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render('login', { user: req.user, categories });
});

// Login route with flash message support
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err); // Handle err ors
        }
        if (!user) {
            // Flash the failure message (from LocalStrategy) and redirect
            req.flash('error', info.message);
            return res.redirect('/auth/login');
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err); // Handle errors during login
            }
            // Flash a success message if you want
            req.flash('success', 'You are successfully logged in!');
            return res.redirect('/'); // Redirect on successful login
        });
    })(req, res, next);
});

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// In your backend routes (e.g., auth.js or similar)
router.get('/check-auth', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true });
    } else {
        res.json({ isAuthenticated: false });
    }
});

module.exports = router;
