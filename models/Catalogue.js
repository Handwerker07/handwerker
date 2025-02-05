const mongoose = require('mongoose');

// Define the schema for the catalogue
const CatalogueSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    link: {
        type: String, // Link to the PDF on Google Drive
        required: true
    },
    photo: {
        data: Buffer, // Photo data (optional)
        contentType: String, // MIME type for the photo
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create a model for the catalogue
const Catalogue = mongoose.model('Catalogue', CatalogueSchema);

module.exports = Catalogue;
