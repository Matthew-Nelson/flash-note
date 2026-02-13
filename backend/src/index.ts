/* eslint-disable no-console -- Server startup logging is intentional */
// IMPORTANT: env-loader must be imported FIRST to ensure environment variables
// are available before any other modules (including Sentry) initialize.
import './env-loader.js';

// Sentry must be imported before other application modules for proper instrumentation.
// ESM hook registration is handled by @sentry/node/preload via --import flag in
// package.json scripts; this import calls Sentry.init() to activate instrumentation.
import { Sentry } from './instrument.js';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { db } from './db/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { notesRouter } from './routes/notes.js';
import { billingRouter } from './routes/billing.js';
import { userRouter } from './routes/user.js';
import { organizationRouter } from './routes/organization.js';
import { usageRouter } from './routes/usage.js';

// Process-level error handlers — must be registered after Sentry.init() (via instrument.js)
// so that Sentry can capture these errors before the process exits.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.name);
  Sentry.captureException(err);
  void Sentry.close(2000).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection');
  Sentry.captureException(reason);
  // Node 15+ will re-throw as uncaughtException → exit handled there
});

const app: Express = express();

// Trust the first proxy hop (Render/Railway/Heroku single reverse proxy).
// Required for correct req.ip in rate limiting, audit logs, and security middleware.
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);
app.use(cors({
  // In production, use the strict allowlist from ALLOWED_ORIGINS
  // In dev/test, allow localhost origins and any Chrome extension
  origin: config.NODE_ENV === 'production'
    ? config.ALLOWED_ORIGINS
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4000', /^chrome-extension:\/\/.+$/],
  credentials: true,
}));

// Body parsing - skip JSON parsing for Stripe webhook (needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.originalUrl === '/billing/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/notes', notesRouter);
app.use('/billing', billingRouter);
app.use('/user', userRouter);
app.use('/organization', organizationRouter);
app.use('/usage', usageRouter);

// Error handling - Sentry must be first to capture errors
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// Graceful shutdown
function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(() => {
    console.log('HTTP server closed');
    void Promise.all([
      Sentry.close(5000),
      db.end(),
    ]).finally(() => process.exit(0));
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = config.PORT;
const server = app.listen(PORT, () => {
  console.log(`FlashNote API running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

export default app;
