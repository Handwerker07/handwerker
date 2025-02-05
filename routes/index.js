const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const ShopCart = require('../models/ShopCart');  // Import the shopping cart model
const Order = require('../models/Orders');
const Catalogue = require('../models/Catalogue'); // Import the Catalogue model
const fs = require('fs');
const path = require('path');


const { marked } = require('marked');
const { ensureAuthenticated } = require('../middleware/auth');

router.get("/cat", async (req, res) => {
    try {
        const filePath = path.join(__dirname, '../categories.json'); // Replace with the actual path to your JSON file
        const data = await fs.promises.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).send('Error reading file');
    }
});


router.get('/', async (req, res) => {
    try {
        // Fetch all items and sort by creation date (latest first)
        const allItems = await Item.find().sort({ createdAt: -1 });

        const allTabItems = await Item.find().sort({ createdAt: -1 }).limit(20);

        // Create a map to store the latest unique items per category
        const uniqueLatestItems = [];
        const seenCategories = new Set();

        for (const item of allItems) {
            if (!seenCategories.has(item.category)) {
                seenCategories.add(item.category);
                uniqueLatestItems.push(item);
            }
        }

        // Limit the unique latest items to the first 3 categories
        const latestItems = uniqueLatestItems.slice(0, 8);

        // Fetch top sale items (limited to 24)
        const topSaleItems = await Item.find().sort({ saleCount: -1 }).limit(24);

        // Load category data from JSON file
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        // Fetch items for each category (limit to 8 items per category)
        const categoryItems = await Promise.all(
            categoriesData.map(async (category) => {
                const items = await Item.find({ category: category.name }).limit(8);
                return items.length > 0 ? { name: category.name, items } : null;
            })
        );

        // Filter categories and limit to the first 6
        const filteredCategories = categoryItems.filter((category) => category !== null).slice(0, 6);

        // Transform latest items: Replace `photos` array with only `_id` strings
        const latestItemsWithPhotoIds = latestItems.map((item) => {
            item.photos = item.photos.map((photo) => photo._id.toString()); // Keep only _id as string
            return item;
        });

        // Transform category items: Replace `photos` array with only `_id` strings
        const categoryItemsWithPhotoIds = filteredCategories.map((category) => {
            category.items = category.items.map((item) => {
                item.photos = item.photos.map((photo) => photo._id.toString()); // Keep only _id as string
                return item;
            });
            return category;
        });

        const allTabItemsWithPhotoIds = allTabItems.map((item) => {
            item.photos = item.photos.map((photo) => photo._id.toString());
            return item;
        });

        res.render('index', {
            latestItems: latestItemsWithPhotoIds, // Pass latest items with photo IDs only
            topSaleItems,
            banners: [
                { image: '/images/banner1.jpg' },
                { image: '/images/banner2.jpg' },
                { image: '/images/banner3.jpg' },
                { image: '/images/banner4.jpg' },
            ],
            user: req.user,
            categoryItems: categoryItemsWithPhotoIds, // Pass category items with photo IDs only
            categories: categoriesData,
            allTabItems: allTabItemsWithPhotoIds, // Pass all tab items (20 max)

        });
    } catch (err) {
        console.error('Error fetching data for homepage:', err);
        res.status(500).render('error', { message: 'Something went wrong. Please try again later.' });
    }
});


// Route to show categories (explore.ejs)
router.get('/explore', async (req, res) => {
    try {
        // Load categories from categories.json
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        // Fetch items for each category and filter out empty categories
        const filteredCategories = await Promise.all(
            categoriesData.map(async (category) => {
                const items = await Item.find({ category: category.name }).limit(8); // Limit to 8 items per category

                if (items.length > 0) {
                    // Fetch subcategories and filter out empty ones
                    const subcategories = await Promise.all(
                        (category.subcategories || []).map(async (subcategory) => {
                            const subcategoryItems = await Item.find({
                                category: category.name,
                                subcategory
                            }).limit(8); // Limit to 8 items per subcategory
                            return subcategoryItems.length > 0 ? { name: subcategory, items: subcategoryItems } : null;
                        })
                    ).then(subs => subs.filter(sub => sub !== null)); // Remove empty subcategories

                    return {
                        ...category,
                        items,
                        subcategories // Include only subcategories with available items
                    };
                }

                return null; // Exclude categories with no items
            })
        ).then(categories => categories.filter(category => category !== null)); // Remove empty categories

        // Get the selected category from the query parameter
        const hashCategory = req.query.category || null;

        // Fetch subcategories and their items for the selected category
        let selectedCategory = null;
        if (hashCategory) {
            const matchingCategory = filteredCategories.find(cat => cat.name === hashCategory);

            if (matchingCategory) {
                selectedCategory = {
                    name: hashCategory,
                    items: matchingCategory.items,
                    subcategories: matchingCategory.subcategories
                };
            }
        }

        res.render('explore', {
            categories: categoriesData,
            filteredCategories, // Filtered categories with items and subcategories
            selectedCategory,
            user: req.user // Pass user info for authentication or user-specific UI
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Product view route
router.get('/product/:id', async (req, res) => {
    try {
        // Load categories from categories.json
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        const item = await Item.findById(req.params.id);
        if (!item) {
            req.flash('error', 'Product not found');
            return res.redirect('/');
        }

        const markdownDescription = marked(item.description || '');
        const markdownDetails = marked(item.details || '');

        res.render('view', { item, user: req.user, markdownDescription, markdownDetails, categories });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Unable to display product');
        res.redirect('/');
    }
});

// View Cart route
router.get('/cart', async (req, res) => {
    try {

        // Load categories from categories.json
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        // Find the cart for the logged-in user
        const cart = await ShopCart.findOne({ user: req.user._id }).populate('items.item');
        res.render('cart', { cart, user: req.user, categories });
    } catch (err) {
        req.flash('error', 'You must login in first.!');
        res.redirect('/auth/login');
    }
});

// Add to Cart route
router.post('/cart/add', async (req, res) => {
    try {
        const { itemId, quantity } = req.body;

        // Find the item in the database
        const item = await Item.findById(itemId);
        if (!item) {
            req.flash('error', 'Item not found');
            return res.redirect('/');
        }

        // Find the user's cart or create a new one if it doesn't exist
        let cart = await ShopCart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new ShopCart({
                user: req.user._id,
                items: [],
            });
        }

        // Check if the item is already in the cart
        const existingItemIndex = cart.items.findIndex(cartItem => cartItem.item.toString() === itemId);

        if (existingItemIndex > -1) {
            // If the item is already in the cart, update the quantity
            cart.items[existingItemIndex].quantity += parseInt(quantity, 10);
        } else {
            // If the item is not in the cart, add it with the quantity
            cart.items.push({
                item: item._id,
                quantity: parseInt(quantity, 10),
                priceAtPurchase: item.price,  // Save the price at the time of addition
            });
        }

        // Save the cart with the updated total price
        await cart.save();

        req.flash('success', 'Item added to cart successfully');
        res.redirect('/cart');  // Redirect to the cart view page
    } catch (err) {
        req.flash('error', 'Failed to add item to cart, you must login first.');
        res.redirect('/auth/login');
    }
});

// Remove item(s) from cart route
router.post('/cart/remove/:id?', async (req, res) => {
    try {
        // Find the cart for the logged-in user
        const cart = await ShopCart.findOne({ user: req.user._id });

        if (!cart) {
            req.flash('error', 'Cart not found');
            return res.redirect('/cart');
        }

        // Check if an individual item is being removed (from the 'Remove' button)
        const itemId = req.params.id;

        if (itemId) {
            // Remove the single item from the cart
            cart.items = cart.items.filter(item => item.item.toString() !== itemId);

        } else if (req.body.selectedItems) {
            // Handle removal of multiple selected items
            const selectedItems = Array.isArray(req.body.selectedItems)
                ? req.body.selectedItems
                : [req.body.selectedItems];

            cart.items = cart.items.filter(item => !selectedItems.includes(item.item.toString()));
        }

        // Save the updated cart
        await cart.save();

        // Flash success message based on removal type
        if (itemId) {
            req.flash('success', 'Item removed from cart');
        } else {
            req.flash('success', 'Selected items removed from cart');
        }

        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Unable to remove item(s) from cart');
        res.redirect('/cart');
    }
});

// Remove Selected Items route
router.post('/cart/remove-selected', async (req, res) => {
    try {
        const selectedItems = req.body.selectedItems; // This will be an array of item IDs

        // Ensure selectedItems is an array
        if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
            req.flash('error', 'No items selected for removal.');
            return res.redirect('/cart');
        }

        // Find the user's cart
        const cart = await ShopCart.findOne({ user: req.user._id });
        if (!cart) {
            req.flash('error', 'Cart not found.');
            return res.redirect('/cart');
        }

        // Filter out the selected items
        cart.items = cart.items.filter(cartItem => !selectedItems.includes(cartItem.item.toString()));

        // Save the updated cart
        await cart.save();

        req.flash('success', 'Selected items removed from cart successfully.');
        res.redirect('/cart'); // Redirect to the cart view page
    } catch (err) {
        console.error(err); // Log the error for debugging
        req.flash('error', 'Failed to remove selected items from cart.');
        res.redirect('/cart');
    }
});


// Search Route with Pagination
router.get('/search', async (req, res) => {
    try {
        const searchQuery = req.query.query;  // Get the search query from the input field
        const sortOption = req.query.sort || 'best-match'; // Get the sort option from the dropdown
        const currentPage = parseInt(req.query.page) || 1;  // Get the current page, default to 1
        const itemsPerPage = 40;  // Define how many items per page
        let searchResults = [];
        let totalResults = 0;
        let totalPages = 0;

        // Load categories from categories.json
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        if (searchQuery) {
            const query = { name: { $regex: new RegExp(searchQuery, 'i') } };  // Case-insensitive search

            // Determine the sort order based on the sort option
            let sortCriteria;
            switch (sortOption) {
                case 'low-to-high':
                    sortCriteria = { price: 1 };  // Price low to high
                    break;
                case 'high-to-low':
                    sortCriteria = { price: -1 }; // Price high to low
                    break;
                default:
                    sortCriteria = { createdAt: -1 }; // Default: Sort by latest (best match)
            }

            // Get total results count
            totalResults = await Item.countDocuments(query);

            // Calculate total pages
            totalPages = Math.ceil(totalResults / itemsPerPage);

            // Get search results based on the query, sort, and pagination
            searchResults = await Item.find(query)
                .sort(sortCriteria)
                .skip((currentPage - 1) * itemsPerPage)  // Skip previous pages' items
                .limit(itemsPerPage);  // Limit the results to items per page
        }


        // Render the search results page, passing totalResults, totalPages, currentPage, and sortOption
        res.render('searchResult', {
            searchResults,
            searchQuery,
            totalResults,
            totalPages,
            currentPage,
            sortOption,
            user: req.user,
            categories
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Route to display items in a specific category and sub-category with sorting and pagination
router.get('/categories/:category/:subCategory?', async (req, res) => {
    const { category, subCategory } = req.params; // `subCategory` is optional
    const sortOption = req.query.sort || 'best-match';
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = 40;

    // Load categories from categories.json
    const categoriesPath = path.join(__dirname, '../categories.json');
    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

    try {
        // Determine sorting criteria
        let sortCriteria = {};
        if (sortOption === 'high-to-low') {
            sortCriteria = { price: -1 };
        } else if (sortOption === 'low-to-high') {
            sortCriteria = { price: 1 };
        } else {
            sortCriteria = { name: 1 }; // Default to best match (alphabetical order)
        }

        // Build query based on the category and optional subCategory
        let query = { category: category }; // Always filter by category
        if (subCategory) {
            query.subcategory = subCategory; // Add subCategory filter only if it exists
        }

        // Count the total number of items for pagination
        const totalItems = await Item.countDocuments(query);

        // Find items matching the query, with pagination and sorting
        const items = await Item.find(query)
            .sort(sortCriteria)
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        // Calculate total pages for pagination
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Render the category page with the items
        res.render('categories', {
            items,
            category,
            subCategory,
            categories,
            message: items.length === 0 ? `No items found for ${subCategory || category}.` : null,
            totalResults: totalItems,
            currentPage: page,
            totalPages,
            sortOption,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).send('Server error');
    }
});


// Place an order (after checking out)
router.post('/order/checkout', ensureAuthenticated, async (req, res) => {
    try {
        const cart = await ShopCart.findOne({ user: req.user._id }).populate('items.item');
        if (!cart || cart.items.length === 0) {
            req.flash('error', 'Your cart is empty');
            return res.redirect('/cart');
        }

        // Calculate updated items with discounted price and compute total price
        let computedTotal = 0;
        const updatedItems = cart.items.map(cartItem => {
            // Assume cartItem.priceAtPurchase is the original price stored at the time of adding to cart.
            let unitPrice = cartItem.priceAtPurchase;
            // If the item has an offer, calculate the discounted price.
            if (cartItem.item.offer > 0) {
                unitPrice = unitPrice - (unitPrice * cartItem.item.offer / 100);
            }
            // Update total price with the discounted price.
            computedTotal += unitPrice * cartItem.quantity;
            return {
                item: cartItem.item,
                quantity: cartItem.quantity,
                priceAtPurchase: unitPrice
            };
        });

        // Create new order with additional payment fields and computed items/total
        const newOrder = new Order({
            user: req.user._id,
            items: updatedItems,
            totalPrice: computedTotal,
            address: req.body.address,
            phoneNumber: req.body.phoneNumber,
            paymentMethod: req.body.paymentMethod, // "bank" or "cod"
            transactionId: req.body.paymentMethod === 'bank' ? req.body.transactionId || "" : ""
        });

        await newOrder.save();

        // Clear the cart after checkout
        await cart.deleteOne();

        req.flash('success', 'Order placed successfully. Your payment will be verified by our admin.');
        res.redirect('/profile?tab=orders');
    } catch (err) {
        console.error(err);
        req.flash('error', 'There was a problem placing your order');
        res.redirect('/cart');
    }
});



// Cancel an order and add items back to cart
router.post('/order/cancel/:id', ensureAuthenticated, async (req, res) => {
    try {
        // Find the order to cancel
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).populate('items.item');

        // Check if the order can be canceled (for example, if its status allows cancellation)
        if (!order || !order.canBeCanceled()) {
            req.flash('error', 'Order cannot be canceled');
            return res.redirect('/profile?tab=orders');
        }

        // Find or create the user's cart
        let cart = await ShopCart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new ShopCart({
                user: req.user._id,
                items: []
            });
        }

        // Add the items from the canceled order back to the cart
        for (const orderItem of order.items) {
            const existingItemIndex = cart.items.findIndex(cartItem => cartItem.item.toString() === orderItem.item._id.toString());

            if (existingItemIndex > -1) {
                // If the item is already in the cart, update the quantity
                cart.items[existingItemIndex].quantity += orderItem.quantity;
            } else {
                // If the item is not in the cart, add it
                cart.items.push({
                    item: orderItem.item._id,
                    quantity: orderItem.quantity,
                    priceAtPurchase: orderItem.priceAtPurchase
                });
            }
        }

        // Save the updated cart
        await cart.save();

        // Remove the order from the order list
        await Order.deleteOne({ _id: req.params.id, user: req.user._id });

        req.flash('success', 'Order canceled and items added back to cart successfully');
        res.redirect('/profile?tab=orders');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not cancel order');
        res.redirect('/profile?tab=orders');
    }
});

// Route for the Catalogues page with pagination
router.get('/catalogues', async (req, res) => {
    try {
        // Parse query parameters for pagination
        const page = parseInt(req.query.page) || 1; // Current page number (default: 1)
        const itemsPerPage = 6; // Number of items per page

        // Calculate total items and total pages
        const totalItems = await Catalogue.countDocuments();
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Fetch paginated catalogues
        const catalogues = await Catalogue.find()
            .skip((page - 1) * itemsPerPage) // Skip items for previous pages
            .limit(itemsPerPage); // Limit items to the current page

        // Load categories from JSON file
        const categoriesPath = path.join(__dirname, '../categories.json');
        const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')).categories;

        // Render the catalogues page
        res.render('catalogues', {
            categories: categoriesData,
            catalogues,
            currentPage: page,
            totalPages,
        });
    } catch (err) {
        console.error('Error fetching catalogues:', err);
        res.status(500).send('Error loading catalogues page');
    }
});

module.exports = router;