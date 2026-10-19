import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import './services.css';
import Services from './Services';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Services />
  </StrictMode>
);
