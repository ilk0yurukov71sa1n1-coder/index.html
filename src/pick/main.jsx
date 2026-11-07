import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './pick.css';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import Pick from './Pick';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Pick />
    </ErrorBoundary>
  </StrictMode>
);
