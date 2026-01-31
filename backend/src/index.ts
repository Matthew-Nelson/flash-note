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
  origin: config.ALLOWED_ORIGINS,
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

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`FlashNote API running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

export default app;
