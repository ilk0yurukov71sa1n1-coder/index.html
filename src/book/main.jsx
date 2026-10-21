import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import './book.css';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import Book from './Book';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Book />
    </ErrorBoundary>
  </StrictMode>
);
