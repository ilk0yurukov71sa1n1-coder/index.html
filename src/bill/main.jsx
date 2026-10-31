import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import './bill.css';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import Bill from './Bill';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Bill />
    </ErrorBoundary>
  </StrictMode>
);
