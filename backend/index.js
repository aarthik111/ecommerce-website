const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const port = process.env.PORT || 4000;

// ✅ CORS setup — must be BEFORE routes/middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "auth-token"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI);

// ✅ Models
const Product = mongoose.model("Product", {
  id: Number,
  name: String,
  image: String,
  category: String,
  new_price: Number,
  old_price: Number,
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true }
});

const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
  date: { type: Date, default: Date.now }
});

// ✅ Static image serving
app.use('/images', express.static('upload/images'));

// ✅ File upload engine
const storage = multer.diskStorage({
  destination: './upload/images',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// ✅ Routes
app.get("/", (req, res) => {
  res.send("Express App is Running");
});

app.post("/upload", upload.single('product'), (req, res) => {
  res.json({
    success: 1,
    image_url: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  });
});

app.post('/addproduct', async (req, res) => {
  try {
    const products = await Product.find({});
    const id = products.length > 0 ? products[products.length - 1].id + 1 : 1;
    const product = new Product({
      id,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: Number(req.body.new_price),
      old_price: Number(req.body.old_price)
    });
    await product.save();
    res.json({ success: true, name: req.body.name });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/removeproduct', async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.body.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/allproducts', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/newcollections', async (req, res) => {
  try {
    const products = await Product.find({});
    const newcollection = products.slice(-8);
    res.json(newcollection);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/popularinwomen', async (req, res) => {
  try {
    const products = await Product.find({ category: "women" });
    const popular = products.slice(0, 4);
    res.json(popular);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/signup', async (req, res) => {
  try {
    const check = await Users.findOne({ email: req.body.email });
    if (check) {
      return res.status(400).json({ success: false, errors: "Email already exists" });
    }
    const cart = {};
    for (let i = 0; i < 300; i++) cart[i] = 0;
    const user = new Users({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      cartData: cart
    });
    await user.save();
    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await Users.findOne({ email: req.body.email });
    if (!user || user.password !== req.body.password) {
      return res.json({ success: false, error: "Invalid email or password" });
    }
    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const fetchUser = async (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ errors: "Token required" });
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data.user;
    next();
  } catch {
    res.status(401).json({ errors: "Invalid token" });
  }
};

app.post('/addtocart', fetchUser, async (req, res) => {
  try {
    const user = await Users.findOne({ _id: req.user.id });
    user.cartData[req.body.itemId] += 1;
    await Users.updateOne({ _id: req.user.id }, { cartData: user.cartData });
    res.json({ success: true, message: "Added" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/removefromcart', fetchUser, async (req, res) => {
  try {
    const user = await Users.findOne({ _id: req.user.id });
    if (user.cartData[req.body.itemId] > 0) {
      user.cartData[req.body.itemId] -= 1;
      await Users.updateOne({ _id: req.user.id }, { cartData: user.cartData });
    }
    res.json({ success: true, message: "Removed" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/getcart', fetchUser, async (req, res) => {
  try {
    const user = await Users.findOne({ _id: req.user.id });
    res.json(user.cartData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Start server
app.listen(port, () => {
  console.log(`Server Running on Port ${port}`);
});
