const express = require("express");
const session = require("express-session");
const connectDB = require("./Config/db");
const dotenv = require("dotenv");
dotenv.config();
const passport = require("./Config/passport");
const cors = require("cors");
const authRoutes = require("./Routes/authRoute");
const gitHubRoutes = require("./Routes/gitHubRoutes");

connectDB();

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173', // frontend URL
  credentials: true // cookies allow karne ke liye
}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(authRoutes);
app.use("/api/github", gitHubRoutes);



// Connect to MongoDB
app.get("/", (req, res) => {
  res.send("Hello, World!");
});
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
})