const express = require("express");
const dotenv = require("dotenv");
const passport = require("../Config/passport");
const router = express.Router();

dotenv.config();
// GitHub login shuru karo
router.get('/auth/github', 
  passport.authenticate('github', { scope: ['repo', 'read:user'] })
);

// GitHub redirect wapas yahan aayega
router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login-failed' }), //passport.authenticate() middleware ka use kar rahe hai req.user exist or not check karne ke liye
  (req, res) => {
    // Success — frontend pe wapas bhejo
     res.redirect(process.env.FRONTEND_URL || 'https://git-hub-code-base-58yx.vercel.app');
  }
);

// Current logged-in user check karne ke liye
router.get('/auth/user', (req, res) => {
 try {
  if (req.isAuthenticated()) {
    const { _id, githubId, username, displayName, avatar } = req.user;
    res.status(200).json({ user: { _id, githubId, username, displayName, avatar } });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
 } catch (error) {
  res.status(500).json({Message : "Internal server error"});
  console.log(error);
 }
});

// Logout
router.get('/auth/logout', (req, res) => {
  try {
    req.logout((err) => {
      if (err) {
        res.status(500).json({Message : "Internal server error"});
        console.log(error);
      } else {
        req.session.destroy((err) => {
          if (err) {
            res.status(500).json({Message : "Internal server error"});
            console.log(error);
          } else {
            res.status(202).json({Message : "Logout successful"});
          }
        });
      }
    });
  } catch (error) {
    res.status(500).json({Message : "Internal server error"});
    console.log(error);
  }
});

module.exports = router;