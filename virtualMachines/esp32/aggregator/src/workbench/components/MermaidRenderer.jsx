// Mermaid Renderer Component - Renders Mermaid diagrams with active state highlighting
import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

/**
 * MermaidRenderer - Renders Mermaid diagrams and supports highlighting active states
 * 
 * @param {Object} props
 * @param {string} props.mermaidSource - Mermaid diagram source code
 * @param {string[]} props.activeStates - Array of state IDs to highlight as active
 * @param {string} props.className - Additional CSS class name
 */
const MermaidRenderer = ({ mermaidSource, activeStates = [], className = '' }) => {
  const containerRef = useRef(null);
  const mermaidIdRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Initialize Mermaid with configuration
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
      },
      stateDiagram: {
        useMaxWidth: true,
      },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !mermaidSource) return;

    const renderDiagram = async () => {
      try {
        // Clear previous content
        containerRef.current.innerHTML = '';

        // Render the Mermaid diagram
        const { svg } = await mermaid.render(mermaidIdRef.current, mermaidSource);
        containerRef.current.innerHTML = svg;

        // Apply active state styling
        if (activeStates.length > 0) {
          applyActiveStateStyles(containerRef.current, activeStates);
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        containerRef.current.innerHTML = `
          <div style="padding: 1rem; border: 2px solid #f44336; border-radius: 4px; background: #ffebee; color: #c62828;">
            <strong>Mermaid Rendering Error</strong>
            <pre style="margin-top: 0.5rem; font-size: 0.875rem;">${error.message}</pre>
          </div>
        `;
      }
    };

    renderDiagram();
  }, [mermaidSource, activeStates]);

  return (
    <div 
      ref={containerRef} 
      className={`mermaid-renderer ${className}`}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: '1rem',
      }}
    />
  );
};

/**
 * Apply CSS classes to highlight active states in the rendered SVG
 */
function applyActiveStateStyles(container, activeStates) {
  if (!container || !activeStates.length) return;

  // Find all state elements in the SVG
  const stateElements = container.querySelectorAll('[id*="state-"]');
  
  stateElements.forEach(element => {
    const elementId = element.id;
    
    // Check if this state is in the active states list
    const isActive = activeStates.some(stateId => {
      const normalizedStateId = stateId.toLowerCase().replace(/[^a-z0-9]/g, '');
      return elementId.toLowerCase().includes(normalizedStateId);
    });

    if (isActive) {
      // Add active class and styling
      element.classList.add('mermaid-active-state');
      
      // Find the rect or path element and apply styling
      const shape = element.querySelector('rect, path, circle, ellipse');
      if (shape) {
        shape.style.fill = '#4caf50';
        shape.style.stroke = '#2e7d32';
        shape.style.strokeWidth = '3px';
        shape.style.filter = 'drop-shadow(0 0 8px rgba(76, 175, 80, 0.6))';
      }

      // Find text elements and make them bold
      const textElements = element.querySelectorAll('text');
      textElements.forEach(text => {
        text.style.fontWeight = 'bold';
        text.style.fill = '#ffffff';
      });
    }
  });

  // Also highlight transitions between active states
  const edges = container.querySelectorAll('[id*="edge-"]');
  edges.forEach(edge => {
    const path = edge.querySelector('path');
    if (path) {
      // Check if this edge connects active states
      const edgeId = edge.id.toLowerCase();
      const isActiveTransition = activeStates.some(stateId => {
        const normalizedStateId = stateId.toLowerCase().replace(/[^a-z0-9]/g, '');
        return edgeId.includes(normalizedStateId);
      });

      if (isActiveTransition) {
        path.style.stroke = '#4caf50';
        path.style.strokeWidth = '3px';
        path.style.filter = 'drop-shadow(0 0 4px rgba(76, 175, 80, 0.4))';
      }
    }
  });
}

export default MermaidRenderer;

// Made with Bob
