// Initialize Sentry BEFORE any other imports
import { initSentry, captureException } from '../shared/sentry';
initSentry();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Global error handlers for the sidepanel context
// Since we filter out GlobalHandlers integration for extension safety,
// we manually capture unhandled errors here.
window.addEventListener('error', (event) => {
  captureException(event.error ?? new Error(event.message), {
    source: 'sidepanel',
    errorType: 'unhandled_error',
  });
});

window.addEventListener('unhandledrejection', (event) => {
  captureException(
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason)),
    {
      source: 'sidepanel',
      errorType: 'unhandled_rejection',
    }
  );
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
