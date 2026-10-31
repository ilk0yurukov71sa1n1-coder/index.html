import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import './services.css';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import Services from './Services';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Services />
    </ErrorBoundary>
  </StrictMode>
);
