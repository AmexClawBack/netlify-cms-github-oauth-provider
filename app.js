const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const cors = require('cors');

const app = express();

// -------------------
// Diagnostics & Env Checks
// -------------------
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED_REJECTION', err);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT_EXCEPTION', err);
  process.exit(1);
});

const REQUIRED_ENV = [
  'OAUTH_CLIENT_ID',
  'OAUTH_CLIENT_SECRET',
  'OAUTH_PROVIDER',
  'GIT_HOSTNAME',
  'REDIRECT_URL',
  'ORIGINS'
];

const missing = REQUIRED_ENV.filter(
  (k) => !process.env[k] || String(process.env[k]).trim() === ''
);

if (missing.length) {
  console.error('MISSING_ENV', missing);
  process.exit(1);
} else {
  console.log('ENV_OK', {
    PORT: process.env.PORT,
    OAUTH_PROVIDER: process.env.OAUTH_PROVIDER,
    GIT_HOSTNAME: process.env.GIT_HOSTNAME,
    REDIRECT_URL: process.env.REDIRECT_URL,
    ORIGINS: process.env.ORIGINS,
  });
}

// -------------------
// Express setup
// -------------------
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: 'oauth-secret',
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// -------------------
// Passport (GitHub)
// -------------------
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      callbackURL: process.env.REDIRECT_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, { profile, accessToken });
    }
  )
);

// -------------------
// Routes
// -------------------
app.get('/auth', passport.authenticate('github', { scope: ['repo'] }));

app.get(
  '/callback',
  passport.authenticate('github', { failureRedirect: '/error' }),
  (req, res) => {
    res.json({
      token: req.user.accessToken,
      profile: req.user.profile,
    });
  }
);

app.get('/error', (req, res) => {
  res.status(500).json({ error: 'OAuth login failed' });
});

// -------------------
// Listen on Render port
// -------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('LISTENING_ON_PORT', PORT));
