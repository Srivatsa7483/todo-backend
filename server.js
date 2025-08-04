import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import authRoutes from "./routes/auth.js";
import User from './models/User.js'; // ✅ Importing User model

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// ✅ MongoDB connection
const MONGO_URI = process.env.MONGO_URI;
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ✅ Todo Schema & Model
const todoSchema = new mongoose.Schema({
  text: String,
  completed: { type: Boolean, default: false },
});
const Todo = mongoose.model("Todo", todoSchema);

// ✅ Middleware to verify token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// ✅ Auth Routes
app.post("/api/auth/signup", async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ error: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();

  res.status(201).json({ message: "User created successfully" });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({ token });
});

// ✅ Protected Todo Routes
app.get("/todos", authMiddleware, async (req, res) => {
  const todos = await Todo.find();
  res.json(todos);
});

app.post("/todos", authMiddleware, async (req, res) => {
  const newTodo = new Todo({ text: req.body.text });
  const saved = await newTodo.save();
  res.json(saved);
});

app.put("/todos/:id", authMiddleware, async (req, res) => {
  const updated = await Todo.findByIdAndUpdate(
    req.params.id,
    { completed: req.body.completed },
    { new: true }
  );
  res.json(updated);
});

app.delete("/todos/:id", authMiddleware, async (req, res) => {
  await Todo.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

// ✅ Root check
app.get("/", (req, res) => {
  res.send("API Running");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
