const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // Import MongoDB tools
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000; // The port your server will run on

// --- IMPORTANT: PASTE YOUR MONGODB ATLAS CONNECTION STRING HERE ---
// Replace the placeholder with the actual string you copied from the MongoDB website.
// Make sure to replace `<password>` with your actual database user password.
const connectionString = 'mongodb+srv://compliance_philscent09:1r2w71jj1FkWiHpe@compliance-repository.acnyuy9.mongodb.net/?retryWrites=true&w=majority&appName=compliance-repository';

// --- Database Variables ---
let db;
let documentsCollection;
let archivesCollection;

// --- Connect to MongoDB Atlas ---
MongoClient.connect(connectionString)
    .then(client => {
        console.log('Connected to Database');
        db = client.db('complianceDB'); // You can name your database anything, e.g., "complianceDB"
        documentsCollection = db.collection('documents');
        archivesCollection = db.collection('archives');
    })
    .catch(error => {
        console.error('Failed to connect to the database!');
        console.error(error);
        process.exit(1); // Exit the process if database connection fails
    });

// --- Middleware ---
app.use(express.json()); // To parse JSON data in requests
app.use(express.static(__dirname)); // To serve your html, css, and js files

// --- File Storage Setup (using Multer for local uploads) ---
// This will save files to a folder named 'uploads' in your project directory.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure the uploads directory exists
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename to prevent overwriting files with the same name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- API Routes (The server's functions) ---

// Get all documents and archives
app.get('/api/documents', async (req, res) => {
    try {
        const documents = await documentsCollection.find().toArray();
        const archives = await archivesCollection.find().toArray();
        res.json({ documents, archives });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ message: 'Error fetching data from the database.' });
    }
});

// Add or Update a document
app.post('/api/documents', upload.single('attachment'), async (req, res) => {
    const docData = JSON.parse(req.body.document);
    if (req.file) {
        docData.attachmentPath = req.file.path; // Save the path to the file
    }

    try {
        // MongoDB uses `_id` for its unique identifier. We need to handle this.
        if (docData._id) { // If it has an _id, it's an update
            const id = new ObjectId(docData._id);
            delete docData._id; // We don't update the _id itself
            await documentsCollection.updateOne({ _id: id }, { $set: docData });
        } else { // No _id means it's a new document
            // We can remove the old client-side 'id' if it exists, as MongoDB provides `_id`
            delete docData.id; 
            await documentsCollection.insertOne(docData);
        }
        res.status(200).json({ message: 'Document saved successfully' });
    } catch (error) {
        console.error('Error saving document:', error);
        res.status(500).json({ message: 'Error saving document to the database.' });
    }
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const result = await documentsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Document not found.' });
        }
        res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ message: 'Error deleting document from the database.' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});