import React from 'react';
import { createRoot } from 'react-dom/client';
import BrokerInstanceLauncher from './BrokerInstanceLauncher';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrokerInstanceLauncher />
  </React.StrictMode>
);
