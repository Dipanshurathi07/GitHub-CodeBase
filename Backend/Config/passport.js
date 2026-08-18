const passport = require('passport');
const dotenv = require('dotenv');
const User = require('../Models/User');

dotenv.config();

const GITHUB_CLIENT_ID = process.env.GitHub_Client_Id;
const GITHUB_CLIENT_SECRET = process.env.GitHub_Client_Secret;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback';
const GitHubStrategy = require('passport-github').Strategy;

passport.serializeUser((user, done) => {
  done(null,user._id); //done means session me kya store kru mean cookie me kya store hoga
});

passport.deserializeUser(async (id, done) => {

    try {

        const user = await User.findById(id);

        done(null, user);

    } catch(err) {

        done(err, null);

    }

});
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: GITHUB_CALLBACK_URL,
    scope: ['repo', 'read:user']
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
      let user = await User.findOne({ githubId: profile.id });
      if(!user){
        user = await User.create({
          githubId: profile.id,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          avatar: profile.photos[0].value,
          accessToken: accessToken
        });
      }else{
        user.accessToken = accessToken;
        await user.save();
      }
      return cb(null, user);
    } catch (error) {
      return cb(error, null);
    }
  }
));

module.exports = passport;