const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://supermarkettatylu.onrender.com/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          let user = await User.findOne({ email: email.toLowerCase() });

          if (user) {
            return done(null, user);
          }

          // Create new user if doesn't exist
          const newUser = new User({
            id: `google-${profile.id}`,
            nombre: profile.name?.givenName || profile.displayName,
            apellido: profile.name?.familyName || '',
            email: email.toLowerCase(),
            photo: profile.photos?.[0]?.value || '',
            passwordHash: 'oauth-google',
            isAdmin: false
          });

          const savedUser = await newUser.save();
          done(null, savedUser);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth not configured - skipping GoogleStrategy registration');
}

module.exports = passport;