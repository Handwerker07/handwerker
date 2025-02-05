const express = require('express');
const Item = require('../models/Item'); // Import the Item model
const CustomOrders = require('../models/CustomOrders'); // Import the Catalogue model
const nodemailer = require('nodemailer');

const router = express.Router();

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // App password from Google
    },
});

router.post('/submit-order', async (req, res) => {
    try {
        const { firstname, lastname, phonenumber, subject, email, message, type } = req.body;

        if (!firstname || !lastname || !email || !message) {
            req.flash('error', 'First name, last name, email, and message are required.');
            res.redirect('/article/projects');
            return;
        }


        const cleanedPhoneNumber = phonenumber ? phonenumber.replace(/[\+\s]/g, '') : "";


        const newOrder = new CustomOrders({
            firstname,
            lastname,
            type,
            phonenumber: cleanedPhoneNumber,
            subject,
            email,
            message,
        });

        await newOrder.save();

        const mailOptions = {
            from: `"The Handwerker" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Message Received - The Handwerker',
            text: `
        Dear ${firstname} ${lastname},
        
        Thank you for reaching out to The Handwerker!
        
        We have received your request and will get back to you as soon as possible. Below are the details of your submission:
        
        -------------------------------------
        Subject: ${subject}
        Message: ${message}
        Phone Number: ${cleanedPhoneNumber || 'Not Provided'}
        -------------------------------------
        
        If you need immediate assistance, feel free to contact us:
        
        📞 Phone: +230 5981 9835  
        ✉️ Email: thehandwerkerfurniture@gmail.com  
        🌍 Website: www.thehandwerker.com  
        
        We appreciate your patience and look forward to assisting you soon.
        
        Best Regards,  
        The Handwerker Team  
        
        -------------------------------------
        The Handwerker © ${new Date().getFullYear()} | All Rights Reserved
            `,
        };


        await transporter.sendMail(mailOptions);

        req.flash('success', 'Your order has been successfully placed! A confirmation email has been sent.');
        res.redirect('/article/projects');
    } catch (error) {
        console.error("Error submitting order:", error);
        req.flash('error', 'An error occurred while submitting the order, please try again later.');
        res.redirect('/article/projects');
    }
});

// routes/api.js
router.get('/getImage/:photoId', async (req, res) => {
    try {
        const { photoId } = req.params;
        res.redirect(`/images/items/${photoId}.webp`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching the image');
    }
});

router.get('/getImage2/:catalogueId', async (req, res) => {
    try {
        const { catalogueId } = req.params;
        res.redirect(`/images/catalogues/${catalogueId}.webp`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching the image');
    }
});

router.get('/getProductImages/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const item = await Item.findById(productId);
        if (!item) return res.status(404).send('Product not found');

        const photos = item.photos.map(photo => ({
            id: photo._id,
            url: `/images/items/${photo._id}.webp`
        }));

        res.json({ photos });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching product images');
    }
});

module.exports = router;
