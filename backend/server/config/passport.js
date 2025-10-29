import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('Google OAuth credentials are not fully configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.');
}

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET, // This should be set in environment variables
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        // You can store user data in your MongoDB here
        const user = {
            googleId: profile.id,
            email: email,
            name: profile.displayName,
            picture: profile.photos[0].value
        };
       return done(null, user);
    } catch (error) {
       console.error('Error in GoogleStrategy verification callback:', error);
       return done(error, null);
    }
}));

export default passport;
