const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const multer = require('multer');
const Database = require("@replit/database");
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });
const db = new Database();
const directoryPath = path.join(__dirname, '/html/uploads');
// Static files middleware
app.use(express.static(path.join(__dirname, "html")));

// Body parsing middleware
app.use(express.json()); // For handling JSON body parsing for POST requests.
app.use(express.static('uploads'));

// Setup file storage configuration
const storage = multer.diskStorage({
destination: function (req, file, cb) {
    cb(null, directoryPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname +  path.extname(file.originalname));
  }
});

// Initialize multer with the defined storage
const upload = multer({ storage: storage });

// Serve files from the 'stored' directory
app.use('/html/uploads', express.static(directoryPath));

app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (res, req) => {
     Location.replace('/home/index.html'); 
});
app.post('/upload', upload.single('image'), (req, res) => {
    // Registration logic remains the same
    const { email, password, height, weight, age, username, info, nativeLanguage } = req.body;
    if (!email || !password || !height || !weight || !age || !username || !info || !nativeLanguage) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    if (req.file && req.file.size > 100 * 1024 * 1024) { // Check if the file size exceeds 100 MB
        return res.status(400).json({ message: "Image size should be less than 100MB" });
    }
    const imagePath = req.file ? req.file.path : null; // Check if an image was uploaded
    const userDetails = {
        email: email,
        password: password,
        height: height,
        weight: weight,
        age: age,
        username: username,
        info: info,
        nativeLanguage: nativeLanguage,
        image: imagePath
    };
    try {
      let req = new XMLHttpRequest();

      req.onreadystatechange = () => {
        if (req.readyState == XMLHttpRequest.DONE) {
          console.log(req.responseText);
        }
      };
        
      req.open("POST", "https://cyclic-chief-pleasure.glitch.me/", true);
      req.setRequestHeader("Content-Type", "application/json");
      req.send(`${userDetails}`);
        const { password, ...responseDetails } = userDetails;
        res.status(200).json({ message: "User registered successfully", userDetails: responseDetails });
    } catch (dbError) {
        res.status(500).json({ message: "Database operation failed", error: dbError.message });
    }
});
// GET route to retrieve user details and image by userId
app.get('/get-details', async (req, res) => {
    try {
        const { username } = req.query;
        const userDetailsJson = await db.get(username);
        if (userDetailsJson === null) {
            return res.status(404).json({ message: "User not found." });
        }
        const userDetails = JSON.parse(userDetailsJson);
        // Check if image path exists and provide a way to access the image
        if (userDetails.image) {
            userDetails.imageUrl = req.protocol + '://' + req.get('host') + '/' + userDetails.image;
        }
        res.status(200).json(userDetails);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while retrieving user details.", error: error.message });
    }
});
// PATCH route to update user details by userId
app.patch('/update-details/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const userDetailsJson = await db.get(username);
        if (userDetailsJson === null) {
            return res.status(404).json({ message: "User not found." });
        }
        // Parse the JSON string back to an object
        const userDetails = JSON.parse(userDetailsJson);
        // Update user details with the provided updates
        const updatedDetails = { ...userDetails, ...req.body };
        // Convert updated details back to JSON string before saving
        await db.set(username, JSON.stringify(updatedDetails));
        res.status(200).json({ message: "User details updated successfully!" });
    } catch (error) {
        res.status(500).json({ message: "An error occurred while updating user details.", error: error.message });
    }
});
app.post('/login', async (req, res) => {
    const username = req.body.username;
  const password = req.body.password;
    try {
        const userDetailsJson = await db.get(username);
        if (userDetailsJson === null) {
            return res.status(404).json({ message: "User not found." });
        }
        const userDetails = JSON.parse(userDetailsJson);
        if (userDetails.password === password) {
            res.status(200).json({ message: "Login successful!", userDetails });
        } else {
            res.status(401).json({ message: "Invalid credentials." });
        }
    } catch (error) {
        res.status(500).json({ message: "An error occurred during login.", error: error.message });
    }
});
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  // Send the file
  res.sendFile(filepath, err => {
    if (err) {
      res.status(404).send("File not found");
    }
  });
});
const activeUsers = {};
const rooms = {};
io.on('connection', (socket) => {
  console.log('A user connected');
const room = 'Main_Chat';
  // Handle user connection
  socket.on('user connected', (username) => {
    activeUsers[socket.id] = username;
    // Send socket.id to the client
    socket.emit('store socket id', socket.id);
socket.leaveAll();
    socket.join(room);
    io.emit('update users', Object.values(activeUsers));
    io.emit('chat message', { username: 'System', text: `${username} has joined the chat`, room: 'Main_Chat' });
    const messageFile = "Main_Chat.txt";
    const messagesString = fs.readFileSync(messageFile, "utf-8");
    const newString = messagesString.replaceAll('d@1 ', '<div class="container"><img src="/uploads/').replaceAll(' d@2 ', '-image.jpg" alt="Avatar"><text style="text-shadow: 0 0 8px blue, 0 0 3px black; font-weight: bold; color:white; margin-top:8px; text-align:center; z-index:1; width:40%;">').replaceAll(' d@3 ', '</text><br><text  style="color:white; z-index:1; background-color:00FF0000;">').replaceAll(' d@4', '</text></div>'); 
    const messages = newString.split("\n");
      // Send stored messages to the connected user
      socket.emit('load messages', messages);
      socket.broadcast.emit("user connected", {
        userID: socket.id,
        username: socket.username,
      });
  });
  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
    // Remove the user from active users
    const username = activeUsers[socket.id];
    delete activeUsers[socket.id];
  io.emit('chat message', { username: 'Server', message: `${username} has left the chat`, room: 'Main_Chat' });
    io.emit('update users', Object.values(activeUsers));
  });
  socket.on('join', (room) => {
    socket.leaveAll();
    socket.join(room);
    const username = activeUsers[socket.id];
    socket.to(room).emit('chat message', { username: 'System', text: `${username} has joined the chat`, room: room });
    const messageFile = `${room}.txt`;
    const messagesString = fs.readFileSync(messageFile, "utf-8");
    const newString = messagesString.replaceAll('d@1 ', '<div class="container"><img src="uploads/').replaceAll(' d@2 ', '-image.jpg" alt="Avatar"><text style="text-shadow: 0 0 8px blue, 0 0 3px black; font-weight: bold; color:white; margin-top:8px; text-align:center; z-index:1; width:40%;">').replaceAll(' d@3 ', '</text><br><text  style="color:white; z-index:1; background-color:00FF0000; max-width:60%;">').replaceAll(' d@4', '</text></div>'); 
    const messages = newString.split("\n");
    socket.emit('load messages', messages);
  });
  socket.on('leave', (room) => {
    socket.leave(room);
  });
  // Handle public chat messages
  socket.on('chat message', (data) => {
    const username = activeUsers[socket.id];
    const msg = data.text;
    const room = data.room || 'Main_Chat';
    const color = data.color;
    if (data.text) {
      // Handle text message
      const message = { username: activeUsers[socket.id], text: data.text, room: data.room, color: data.color };
      io.in(room).emit('chat message', message);
        // Correctly format and save the new message into the text file
        const formattedMessage = `d@1 ${username} d@2 ${username}: d@3 ${msg} d@4\n`;
        fs.appendFileSync(`${room}.txt`, formattedMessage);
    }
    if (data.image) {
      // Handle image message
      const { fileName, data: imageData } = data.image;
      const message = { username: activeUsers[socket.id], image: { fileName, data: imageData }, text: data.text, room: data.room };
      io.in(room).emit('chat message', message);
    }
  });
  socket.on('request online users', () => {
    // Assuming 'activeUsers' holds your online usernames with socket.id as the keys
    const onlineUsers = Object.values(activeUsers); // Convert object to an array of usernames
    // Respond back to the requester with the list of online users
    socket.emit('online users list', onlineUsers);
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
