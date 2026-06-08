import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent iOS Safari / PWA double-finger pinch-to-zoom gestures
if (typeof window !== 'undefined') {
  // Prevent gesture zoom events (very effective in Safari)
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gestureend', (e) => {
    e.preventDefault();
  }, { passive: false });

  // Prevent double-finger touchstart zoom attempts
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Prevent double-finger touchmove zooming
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Prevent double-tap to zoom on Safari/iOS PWA, without blocking rapid button/input taps
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement;
        if (target) {
          const tagName = target.tagName.toUpperCase();
          const isInteractive = tagName === 'BUTTON' ||
            tagName === 'INPUT' ||
            tagName === 'TEXTAREA' ||
            tagName === 'A' ||
            tagName === 'SELECT' ||
            target.closest('button') ||
            target.closest('a') ||
            target.getAttribute('role') === 'button';
          if (!isInteractive) {
            e.preventDefault();
          }
        }
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
