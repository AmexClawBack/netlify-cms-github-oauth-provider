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

// IMPORTANT: Return a tiny HTML page that postMessage's the token to the opener (Decap CMS)
app.get(
  '/callback',
  passport.authenticate('github', { failureRedirect: '/error' }),
  (req, res) => {
    const token = req.user && req.user.accessToken ? req.user.accessToken : '';
    // HTML that notifies the CMS (in the parent window) about success, then closes the popup.
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Auth Success</title></head>
<body>
<script>
  (function () {
    try {
      var payload = { token: ${JSON.stringify(token)}, provider: 'github' };
      // Decap/Netlify CMS listens for this exact postMessage prefix:
      var msg = 'authorization:github:success:' + JSON.stringify(payload);
      // Use "*" so CMS receives the message regardless of origin (it validates on its side).
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage(msg, '*');
      }
    } catch (e) { /* ignore */ }
    window.close();
  })();
</script>
</body></html>`;
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  }
);

// Send a similar page for errors, so CMS can handle them gracefully
app.get('/error', (req, res) => {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Auth Error</title></head>
<body>
<script>
  (function () {
    try {
      var payload = { error: 'OAuth login failed' };
      var msg = 'authorization:github:error:' + JSON.stringify(payload);
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage(msg, '*');
      }
    } catch (e) { /* ignore */ }
    window.close();
  })();
</script>
</body></html>`;
  res.set('Content-Type', 'text/html; charset=utf-8').status(400).send(html);
});

// -------------------
// Listen on Render port
// -------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('LISTENING_ON_PORT', PORT));
