import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { notesRouter } from './routes/notes.js';
import { billingRouter } from './routes/billing.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.NODE_ENV === 'production'
    ? [config.WEB_URL]
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

// Body parsing
app.use(express.json());

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
