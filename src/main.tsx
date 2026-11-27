import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Register PWA service worker in production; unregister stale dev service workers in dev preview
try {
  if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        void reg.unregister().catch(() => {});
      }
    });
  } else {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          window.setInterval(() => {
            void registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        }
      },
    });
  }
} catch {
  // Ignore in non-SW environments (e.g. unit tests)
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
