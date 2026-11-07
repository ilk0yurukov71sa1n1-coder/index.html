import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import './playground.css';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import Playground from './Playground';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Playground />
    </ErrorBoundary>
  </StrictMode>
);
