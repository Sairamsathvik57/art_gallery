// Import required modules
const express = require("express");
const path = require("path");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bodyParser = require("body-parser");
const { User } = require("./models/user");
const db = require("./services/db");

// Create express app
const app = express();

// Session config
const oneDay = 1000 * 60 * 60 * 24;
const sessionMiddleware = session({
  secret: "art-gallery",
  saveUninitialized: true,
  cookie: { maxAge: oneDay },
  resave: false,
});

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(sessionMiddleware);
app.use(express.static("static"));

// View engine
app.set("view engine", "pug");
app.set("views", "./app/views");

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./static/images"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});
const upload = multer({ storage });

// Routes
app.get("/", (req, res) => res.render("home"));

app.get("/login", (req, res) => {
  if (req.session.uid) return res.redirect("/gallery");
  res.render("login");
});

app.get("/register", (req, res) => res.render("register"));

app.post("/set-password", async (req, res) => {
  const { email, password, contactNumber, address } = req.body;
  if (!email || !password) return res.status(400).send("Email and password are required.");
  const user = new User(email, contactNumber, address);
  const uId = await user.getIdFromEmail();
  if (uId) {
    await user.setUserPassword(password);
    return res.status(200).send("Password updated.");
  } else {
    await user.addUser(password, contactNumber, address);
    return res.status(201).send("User created.");
  }
});

app.post("/authenticate", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send("Email and password are required.");
  const user = new User(email);
  const uId = await user.getIdFromEmail();
  if (!uId || !(await user.authenticate(password))) return res.status(401).send("Invalid credentials");
  req.session.uid = uId;
  req.session.loggedIn = true;
  res.redirect("/gallery");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/gallery", async (req, res) => {
  const selectedCategory = req.query.category || "";
  let sql = selectedCategory ? "SELECT * FROM Artworks WHERE category = ?" : "SELECT * FROM Artworks";
  const artworks = await db.query(sql, selectedCategory ? [selectedCategory] : []);
  const categories = (await db.query("SELECT DISTINCT category FROM Artworks")).map(row => row.category);
  res.render("art-gallery", { artworks, categories, selectedCategory });
});

app.get("/my-gallery", async (req, res) => {
  const artworks = await db.query("SELECT * FROM Artworks WHERE user_id = ?", [req.session.uid]);
  res.render("my-gallery", { artworks });
});

app.get("/artworks/new", (req, res) => res.render("upload-art"));

app.post('/artworks', upload.single('image'), async (req, res) => {
  const { title, description, category } = req.body;
  const image = req.file.filename;
  await db.query(
    "INSERT INTO Artworks (title, description, image, category, user_id) VALUES (?, ?, ?, ?, ?)",
    [title, description, image, category, req.session.uid]
  );
  res.redirect('/my-gallery');
});


app.get("/artworks/edit/:id", async (req, res) => {
  const results = await db.query("SELECT * FROM Artworks WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
  res.render("edit-art", { artwork: results[0] });
});

app.post("/artworks/update/:id", async (req, res) => {
  const { title, description, image, category } = req.body;
  await db.query("UPDATE Artworks SET title = ?, description = ?, image = ?, category = ? WHERE id = ? AND user_id = ?",
    [title, description, image, category, req.params.id, req.session.uid]);
  res.redirect("/my-gallery");
});

app.post("/artworks/delete/:id", async (req, res) => {
  await db.query("DELETE FROM Artworks WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
  res.redirect("/my-gallery");
});

app.get("/profile", async (req, res) => {
  const results = await db.query("SELECT * FROM Users WHERE id = ?", [req.session.uid]);
  res.render("profile", { user: results[0] });
});

app.post("/profile/update", async (req, res) => {
  const { contactNumber, address } = req.body;
  await db.query("UPDATE Users SET contactNumber = ?, address = ? WHERE id = ?", [contactNumber, address, req.session.uid]);
  res.redirect("/profile");
});

app.post('/favourites/add/:id', async (req, res) => {
  try {
    const userId = req.session.uid;
    const artworkId = req.params.id;

    if (!userId) return res.status(401).send('Not logged in');

    const sql = "INSERT IGNORE INTO Favorites (user_id, artwork_id) VALUES (?, ?)";
    await db.query(sql, [userId, artworkId]);

    res.redirect('/gallery'); // or res.send("Added") for AJAX
  } catch (err) {
    console.error("Error adding to favourites:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/favourites', async (req, res) => {
  try {
    const userId = req.session.uid;

    const sql = `
      SELECT a.* FROM Artworks a
      JOIN Favorites f ON a.id = f.artwork_id
      WHERE f.user_id = ?
    `;
    const artworks = await db.query(sql, [userId]);

    res.render('favourites', { artworks });
  } catch (err) {
    console.error("Error loading favourites:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/favourites/remove/:id', async (req, res) => {
  try {
    const userId = req.session.uid;
    const artworkId = req.params.id;

    const sql = "DELETE FROM Favorites WHERE user_id = ? AND artwork_id = ?";
    await db.query(sql, [userId, artworkId]);

    res.redirect('/favourites');
  } catch (err) {
    console.error("Error removing favourite:", err.message);
    res.status(500).send("Internal Server Error");
  }
});





// Start server
app.listen(3000, () => console.log("Server running at http://127.0.0.1:3000/"));
