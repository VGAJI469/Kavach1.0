const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // place your Firebase service account JSON here

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/** Middleware to verify Firebase ID token */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const idToken = match[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded; // attach decoded token (uid, email, etc.)
    next();
  } catch (err) {
    console.error('[Auth Middleware] Token verification failed:', err);
    return res.status(401).json({ error: 'Invalid ID token' });
  }
};
