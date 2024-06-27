

const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const multer = require('multer');
const path = require('path');
// require('dotenv').config(); // Ensure you are loading environment variables

const app = express();
const saltRounds = 10;

// Connection URL
const url = 'mongodb://127.0.0.1:27017/';
const client = new MongoClient(url);
const dbName = 'mriirs';
let db;

// Static folder for uploaded files
app.use('/uploads', express.static('uploads'));

// Setting EJS as the view engine
app.set("view engine", "ejs");

// Configuring Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// Connect to MongoDB
async function connectToDB() {
  try {
    await client.connect();
    db = client.db(dbName);
    console.log('Connected successfully to MongoDB server');
  } catch (e) {
    console.error('Could not connect to MongoDB', e);
  }
}
connectToDB();

// Routes
app.get('/', (req, res) => {
  console.log('Cookies: ', req.cookies);
  console.log('Signed Cookies: ', req.signedCookies);
  res.render('home', { isAuthenticated: false });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'admin.html'));
});

app.get('/admin/complaints', async (req, res) => {
  try {
    const collection = db.collection('complaints');
    const complaints = await collection.find({}).toArray();
    res.json(complaints);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error fetching complaints');
  }
});

app.post('/', upload.single('uploaded_file'), async (req, res) => {
  const { user_email, user_name, user_location, user_message } = req.body;
  const filePath = req.file.path;

  try {
    const collection = db.collection('complaints');
    await collection.insertOne({
      email: user_email,
      name: user_name,
      location: user_location,
      message: user_message,
      img_path: filePath,
    });
    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.status(500).send('Error saving complaint');
  }
});

app.post('/signup', async (req, res) => {
  const { user_email, user_pwd, confirm_pwd } = req.body;

  if (user_pwd !== confirm_pwd) {
    return res.send("Passwords don't match!");
  }

  try {
    const collection = db.collection('users');
    const user = await collection.findOne({ email: user_email });

    if (user) {
      return res.send('User already exists');
    }

    const hashedPassword = await bcrypt.hash(user_pwd, saltRounds);
    await collection.insertOne({ email: user_email, password: hashedPassword });
    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.send('There was an error!');
  }
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'signup.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'login.html'));
});

app.post('/login', async (req, res) => {
  const { user_email, user_pwd } = req.body;

  try {
    const collection = db.collection('users');
    const user = await collection.findOne({ email: user_email });

    if (!user || !(await bcrypt.compare(user_pwd, user.password))) {
      return res.send('Invalid email or password');
    }

    const token = jwt.sign({ email: user_email }, 'shhhhh');
    res.cookie('auth_token', token);
    res.render('home', { isAuthenticated: true });
  } catch (e) {
    console.error(e);
    res.send('Error logging in');
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});


