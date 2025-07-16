// Import express.js
const express = require("express");
const { User } = require("./models/user");
// const db = require('./services/db');
// Create express app
const app = express();

app.use(express.static("static"));

app.set('view engine', 'pug');
app.set('views', './app/views');

const cookieParser = require("cookie-parser");
const session = require('express-session');
const bodyParser = require('body-parser');
const oneDay = 1000 * 60 * 60 * 24;
const sessionMiddleware = session({
    secret: "driveyourpassion",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
});
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(sessionMiddleware);

// Add static files location
app.use(express.static("static"));

// Get the functions in the db.js file to use
const db = require('./services/db');

app.get("/login", (req, res) => {
    try {
        if (req.session.uid) {
            res.redirect('/gallery');
        } else {
            res.render('login');
        }
    } catch (err) {
        console.error("Error accessing root route:", err);
        res.status(500).send('Internal Server Error');
    }
});
app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/register", (req, res) => {
    res.render("register");
});

// Route to show Art Gallery with optional category filtering
app.get('/gallery', async (req, res) => {
    try {
        const selectedCategory = req.query.category || '';
        let sql, params;

        if (selectedCategory) {
            sql = "SELECT * FROM Artworks WHERE category = ?";
            params = [selectedCategory];
        } else {
            sql = "SELECT * FROM Artworks";
            params = [];
        }

        const artworks = await db.query(sql, params);

        // Get distinct categories for filter dropdown
        const categoryResults = await db.query("SELECT DISTINCT category FROM Artworks");
        const categories = categoryResults.map(row => row.category);

        res.render('art-gallery', {
            artworks,
            categories,
            selectedCategory
        });

    } catch (err) {
        console.error("Error loading gallery:", err.message);
        res.status(500).send("Internal Server Error");
    }
});


app.post('/set-password', async (req, res) => {
    const { email, password, contactNumber, address } = req.body;

    if (!email || !password) {
        return res.status(400).send('Email and password are required.');
    }

    try {
        const user = new User(email, contactNumber, address);

        const uId = await user.getIdFromEmail();
        if (uId) {
            await user.setUserPassword(password);
            console.log(`Password updated for user ID: ${uId}`);
            return res.status(200).send('Password set successfully.');
        } else {
            await user.addUser(password, contactNumber, address);
            console.log(`New user created with email: ${email}`);
            return res.status(201).send('New user created successfully.');
        }
    } catch (err) {
        console.error(`Error while setting password:`, err.message);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/authenticate', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send('Email and password are required.');
        }

        const user = new User(email);
        const uId = await user.getIdFromEmail();
        if (!uId) {
            return res.status(401).send('Invalid email');
        }

        const match = await user.authenticate(password);
        if (!match) {
            return res.status(401).send('Invalid password');
        }

        req.session.uid = uId;
        req.session.loggedIn = true;
        res.redirect('/gallery');
    } catch (err) {
        console.error(`Error while authenticating user:`, err.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/logout', (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
    } catch (err) {
        console.error("Error logging out:", err);
        res.status(500).send('Internal Server Error');
    }
});

// Create a route for root - /
app.get("/", function(req, res) {
    res.render("home")
});

// Create a route for testing the db
app.get("/db_test", function(req, res) {
    // Assumes a table called test_table exists in your database
    sql = 'select * from test_table';
    db.query(sql).then(results => {
        console.log(results);
        res.send(results)
    });
});

// Create a route for /goodbye
// Responds to a 'GET' request
app.get("/goodbye", function(req, res) {
    res.send("Goodbye world!");
});

// Create a dynamic route for /hello/<name>, where name is any value provided by user
// At the end of the URL
// Responds to a 'GET' request
app.get("/hello/:name", function(req, res) {
    // req.params contains any parameters in the request
    // We can examine it in the console for debugging purposes
    console.log(req.params);
    //  Retrieve the 'name' parameter and use it in a dynamically generated page
    res.send("Hello " + req.params.name);
});

// Start server on port 3000
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});