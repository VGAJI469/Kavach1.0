require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/auth');

const workersRouter = require('./routes/workers');
const policiesRouter = require('./routes/policies');
const claimsRouter = require('./routes/claims');
const simulateRouter = require('./routes/simulate');
const payoutsRouter = require('./routes/payouts');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Public routes (e.g., health check)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protected routes – all require Firebase ID token
app.use('/api', authMiddleware);
app.use('/api/workers', workersRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/payouts', payoutsRouter);

app.listen(PORT, () => console.log(`[Kavach Server] Listening on port ${PORT}`));
