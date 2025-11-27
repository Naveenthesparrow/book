const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Admin password (hard‑coded for demo purposes)
const ADMIN_PASSWORD = 'book25';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Ensure books.json exists
const dataFile = path.join(__dirname, 'books.json');
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Use timestamp to avoid name collisions, keep original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files
app.use(express.urlencoded({ extended: true }));

// Helper to read books
const getBooks = () => {
    const data = fs.readFileSync(dataFile);
    return JSON.parse(data);
};

// Helper to save books
const saveBook = (book) => {
    const books = getBooks();
    books.push(book);
    fs.writeFileSync(dataFile, JSON.stringify(books, null, 2));
};

// Routes

// Home page
app.get('/', (req, res) => {
    const books = getBooks();
    res.render('index', { books });
});

// Admin page
app.get('/admin', (req, res) => {
    const books = getBooks();
    res.render('admin', { books });
});

// Handle upload
app.post('/upload', upload.single('bookFile'), (req, res) => {
    const { title, password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).send('Invalid admin password.');
    }
    if (!req.file) {
        return res.status(400).send('No file uploaded or invalid file type.');
    }

    const newBook = {
        id: Date.now().toString(),
        title: title || req.file.originalname,
        filename: req.file.filename
    };

    saveBook(newBook);
    res.redirect('/');
});

// Start server
// Delete a book (admin only)
app.post('/delete/:id', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).send('Invalid admin password.');
    }
    const bookId = req.params.id;
    const books = getBooks();
    const bookIndex = books.findIndex(b => b.id === bookId);
    if (bookIndex === -1) {
        return res.status(404).send('Book not found');
    }
    const [removed] = books.splice(bookIndex, 1);
    // Delete the physical PDF file
    const filePath = path.join(uploadDir, removed.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    // Save updated list
    fs.writeFileSync(dataFile, JSON.stringify(books, null, 2));
    res.redirect('/admin');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
