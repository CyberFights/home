const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const multer = require("multer");
const betterSqlite3 = require("better-sqlite3");

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });
const db = betterSqlite3("chat_app.db");

// Directory for uploads
const directoryPath = path.join(__dirname, "/html/uploads");

// Static files middleware
app.use(express.static(path.join(__dirname, "html")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup file storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, directoryPath),
  filename: (req, file, cb) => cb(null, file.fieldname + path.extname(file.originalname)),
});

const upload = multer({ storage });

// Serve uploaded files
app.use("/html/uploads", express.static(directoryPath));

// Initialize SQLite tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    height INTEGER,
    weight INTEGER,
    age INTEGER,
    info TEXT,
    nativeLanguage TEXT,
    imagePath TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT,
    color TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Routes
app.get("/", (req, res) => {
  res.redirect("/home/index.html");
});

app.post("/upload", upload.single("image"), (req, res) => {
  const { email, password, height, weight, age, username, info, nativeLanguage } = req.body;
  if (!email || !password || !height || !weight || !age || !username || !info || !nativeLanguage) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  const imagePath = req.file ? req.file.path : null;

  try {
    db.prepare(`
      INSERT INTO users (username, email, password, height, weight, age, info, nativeLanguage, imagePath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, email, password, height, weight, age, info, nativeLanguage, imagePath);

    res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Database operation failed", error: error.message });
  }
});

app.get("/get-details", (req, res) => {
  const { username } = req.query;

  try {
    const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.imagePath) {
      user.imageUrl = `${req.protocol}://${req.get("host")}/${user.imagePath}`;
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "An error occurred while retrieving user details.", error: error.message });
  }
});

app.patch("/update-details/:username", (req, res) => {
  const { username } = req.params;
  const updates = req.body;

  try {
    const existingUser = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
    if (!existingUser) return res.status(404).json({ message: "User not found." });

    db.prepare(`
      UPDATE users SET email = ?, password = ?, height = ?, weight = ?, age = ?, info = ?, nativeLanguage = ?, imagePath = ?
      WHERE username = ?
    `).run(
      updates.email || existingUser.email,
      updates.password || existingUser.password,
      updates.height || existingUser.height,
      updates.weight || existingUser.weight,
      updates.age || existingUser.age,
      updates.info || existingUser.info,
      updates.nativeLanguage || existingUser.nativeLanguage,
      updates.imagePath || existingUser.imagePath,
      username
    );

    res.status(200).json({ message: "User details updated successfully!" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred while updating user details.", error: error.message });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");
  const room = "Main_Chat";

  socket.on("user connected", (username) => {
    socket.join(room);

    const messages = db.prepare(`SELECT * FROM messages WHERE room = ? ORDER BY timestamp ASC`).all(room);
    socket.emit("load messages", messages);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("chat message", (data) => {
    const { username, text, room = "Main_Chat", color } = data;
    if (text) {
      db.prepare(`
        INSERT INTO messages (room, username, message, color)
        VALUES (?, ?, ?, ?)
      `).run(room, username, text, color);

      io.in(room).emit("chat message", { username, text, room, color });
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));