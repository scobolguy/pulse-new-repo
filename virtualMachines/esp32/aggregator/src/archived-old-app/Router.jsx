// Simple router component to handle / and /x routes
import React, { useState, useEffect } from 'react';
import App from './App';
import Workbench from '../workbench/Workbench';

/**
 * Simple hash-based router
 * - / or empty hash: Original App
 * - /x: Experimental Workbench
 */
const Router = () => {
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash.slice(1) || '/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route to appropriate component
  if (currentPath === '/x') {
    return <Workbench />;
  }

  // Default to original App
  return <App />;
};

export default Router;

// Made with Bob
