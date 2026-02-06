// IMPORTANT: env-loader must be imported FIRST to ensure environment variables
// are available before any other modules (including Sentry) initialize.
import './env-loader.js';

// Sentry must be imported before other application modules for proper instrumentation
import { Sentry } from './instrument.js';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { notesRouter } from './routes/notes.js';
import { billingRouter } from './routes/billing.js';

const app: Express = express();

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

// Error handling - Sentry must be first to capture errors
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`FlashNote API running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

export default app;
