const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Your User model
const fs = require("fs");
const cors = require('cors');
const Item = require('./models/Item'); // Import the Item model
const Catalogue = require('./models/Catalogue'); // Import the Item model
const sharp = require('sharp')
require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("🚀 MongoDB connected."))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

// **Preprocess Images Function**
const preprocessImages = async () => {
    try {
        console.log("🔄 Preprocessing images...");
        const publicDir = path.join(__dirname, "public", "images");
        const itemDir = path.join(publicDir, "items");
        const catalogueDir = path.join(publicDir, "catalogues");

        // Create directories if they don't exist
        fs.mkdirSync(itemDir, { recursive: true });
        fs.mkdirSync(catalogueDir, { recursive: true });

        // Process Item images
        const items = await Item.find();
        for (const item of items) {
            for (const photo of item.photos) {
                const outputPath = path.join(itemDir, `${photo._id}.webp`);
                if (!fs.existsSync(outputPath)) {
                    await sharp(photo.data).webp({ quality: 75 }).toFile(outputPath);
                }
            }
        }

        // Process Catalogue images
        const catalogues = await Catalogue.find();
        for (const catalogue of catalogues) {
            if (catalogue.photo) {
                const outputPath = path.join(catalogueDir, `${catalogue._id}.webp`);
                if (!fs.existsSync(outputPath)) {
                    await sharp(catalogue.photo.data).webp({ quality: 80 }).toFile(outputPath);
                }
            }
        }

        console.log("✅ Image preprocessing completed.");
    } catch (error) {
        console.error("❌ Error in image processing:", error);
    }
};

// **Real-time Image Processing Setup**
const watchForChanges = async () => {
    const db = mongoose.connection;
    try {
        if (db.readyState !== 1) {
            console.error("❌ Database is not connected!");
            return;
        }

        console.log("👀 Watching MongoDB for changes...");

        // Check if MongoDB is a replica set
        const adminDb = db.db.admin();
        const { setName } = await adminDb.command({ replSetGetStatus: 1 }).catch(() => ({}));

        if (setName) {
            // **Change Stream (Requires Replica Set)**
            db.collection("items")
                .watch()
                .on("change", async (change) => {
                    console.log("🔄 Change detected:", change);
                    await preprocessImages();
                });

            db.collection("catalogues")
                .watch()
                .on("change", async (change) => {
                    console.log("🔄 Catalogue change detected:", change);
                    await preprocessImages();
                });
        } else {
            // **Fallback to Polling if No Replica Set**
            console.warn("⚠️ Replica Set not detected! Switching to polling every 30s seconds.");

            setInterval(async () => {
                console.log("🔍 Checking for new items...");
                await preprocessImages();
            }, 30000); // Poll every 30 seconds
        }
    } catch (error) {
        console.error("❌ Error setting up real-time processing:", error);
    }
};

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));
app.use(
    "/images",
    express.static(path.join(__dirname, "public", "images"), {
        maxAge: "1y",
        immutable: true,
    })
);

// Other middleware
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
// Session Middleware with persistent store and 14-day cookie lifetime
app.use(session({
    secret: 'your-secret-key', // Replace with your actual secret
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 14 * 24 * 60 * 60 * 1000  // 14 days in milliseconds
    },
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URL,  // Use your MongoDB connection string
        collectionName: 'sessions',       // Optional: name of the collection to store sessions
    })
}));
app.use(flash());

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Set EJS as templating engine
app.set('view engine', 'ejs');

// CORS configuration
const corsOptions = {
    methods: ['GET', 'POST', 'PATCH', 'DELETE', "PUT"], // Allowed methods
    allowedHeaders: ['Content-Type'], // Allowed headers
};

app.use(cors(corsOptions)); // Enable CORS with the options

// Database connection
mongoose
    .connect(`${process.env.MONGO_URL}`)
    .then(async () => {
        console.log('Connected to DB');
        await preprocessImages();
        console.log('Image preprocessing completed');
    })
    .catch((err) => {
        throw err;
    });

// Global middleware for flash messages
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Passport Local Strategy for Login
passport.use(new LocalStrategy(
    {
        usernameField: 'email',
        passwordField: 'password',
    },
    async (email, password, done) => {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                return done(null, false, { message: 'Incorrect email.' });
            }
            const isMatch = await user.matchPassword(password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// Serialize and deserialize user for session handling
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, false);
    }
});

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// Routes
const indexRoutes = require('./routes/index');
const profileRoutes = require('./routes/profile');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const articleRoutes = require('./routes/article');
const favouritesRoutes = require('./routes/favourites');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/profile', profileRoutes);
app.use('/api', apiRoutes);
app.use('/article', articleRoutes);
app.use('/favourites', favouritesRoutes);

// Start Server
const startServer = async () => {
    await preprocessImages(); // Process existing images
    await watchForChanges(); // Start watching for changes

    app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
};

// Run the server
startServer();