const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { ensureAuthenticated } = require("../middleware/auth");

// Get favorite products for the user
router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        // Load categories from categories.json
        const categoriesPath = path.join(__dirname, "../categories.json");
        const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, "utf-8")).categories;

        const user = await User.findById(req.user._id).populate("favourites");
        if (!user) return res.status(404).send("User not found");

        res.render("favourites", {
            user,
            items: user.favourites,
            categories: categoriesData,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

router.get("/check/:productId", ensureAuthenticated, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isFavorite = user.favourites.includes(req.params.productId);
        res.json({ isFavorite });
    } catch (error) {
        console.error("Error in /check/:productId:", error);
        res.status(500).json({ error: "Server Error" });
    }
});


// Add or remove a product from favourites
router.post("/toggle/:productId", ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, error: "User not found" });

        const productId = req.params.productId;

        if (user.favourites.includes(productId)) {
            // Remove the product from favourites
            user.favourites = user.favourites.filter((id) => id.toString() !== productId);
        } else {
            // (On other pages this would add it; on favourites page, this branch should not occur.)
            user.favourites.push(productId);
        }

        await user.save();
        res.json({ success: true, favourites: user.favourites });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});


module.exports = router;
