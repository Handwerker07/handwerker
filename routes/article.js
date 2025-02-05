const express = require("express");
const router = express.Router();
const path = require("path")
const fs = require("fs")

// Route for the Contact page
router.get("/contact", (req, res) => {
    // Load category data from JSON file
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render("articles/contact", {
        categories: categoriesData,
    });
});

// Route for the About page
router.get("/about", (req, res) => {
    // Load category data from JSON file
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render("articles/about", {
        categories: categoriesData,
    });
});

// Route for the Projects page
router.get("/projects", (req, res) => {

    // Load category data from JSON file
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render("articles/projects", {
        categories: categoriesData,
    });
});

router.get("/delivery", (req, res) => {

    // Load category data from JSON file
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render("articles/delivery", {
        categories: categoriesData,
    });
});

router.get("/terms", (req, res) => {

    // Load category data from JSON file
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    res.render("articles/terms", {
        categories: categoriesData,
    });
});

module.exports = router;
