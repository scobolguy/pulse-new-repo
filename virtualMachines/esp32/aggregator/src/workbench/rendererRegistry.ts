// Renderer Registry - Core infrastructure for pluggable renderer system
import React from 'react';
import { RendererEntry, RendererKey, Role, FileType, Mode } from './types';

// In-memory registry store
const registry: RendererEntry[] = [];

/**
 * Register a renderer component for a specific (role, fileType, mode) combination
 */
export function registerRenderer(params: {
  role: Role;
  fileType: FileType;
  mode: Mode;
  component: React.ComponentType<any>;
  priority?: number;
}): void {
  const entry: RendererEntry = {
    key: {
      role: params.role,
      fileType: params.fileType,
      mode: params.mode,
    },
    component: params.component,
    priority: params.priority ?? 0,
  };
  
  registry.push(entry);
}

/**
 * Get the best matching renderer for the given (role, fileType, mode) combination
 * 
 * Resolution rules:
 * 1. Try exact match: role + fileType + mode
 * 2. Try fileType + mode (any role)
 * 3. Try fileType only (any role, any mode)
 * 4. Return DefaultRenderer
 * 
 * When multiple entries match, choose the one with highest priority
 */
export function getRenderer(
  role: Role,
  fileType: FileType,
  mode: Mode
): React.ComponentType<any> {
  // Try exact match
  let matches = registry.filter(
    entry =>
      entry.key.role === role &&
      entry.key.fileType === fileType &&
      entry.key.mode === mode
  );
  
  if (matches.length > 0) {
    return selectByPriority(matches);
  }
  
  // Try fileType + mode (any role)
  matches = registry.filter(
    entry =>
      entry.key.fileType === fileType &&
      entry.key.mode === mode
  );
  
  if (matches.length > 0) {
    return selectByPriority(matches);
  }
  
  // Try fileType only (any role, any mode)
  matches = registry.filter(
    entry => entry.key.fileType === fileType
  );
  
  if (matches.length > 0) {
    return selectByPriority(matches);
  }
  
  // Return default renderer
  return DefaultRenderer;
}

/**
 * Select the renderer with the highest priority from a list of matches
 */
function selectByPriority(matches: RendererEntry[]): React.ComponentType<any> {
  if (matches.length === 1) {
    return matches[0].component;
  }
  
  // Sort by priority (descending) and return the first one
  const sorted = [...matches].sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    return priorityB - priorityA;
  });
  
  return sorted[0].component;
}

/**
 * Default renderer shown when no specific renderer is registered
 */
export const DefaultRenderer: React.FC<{
  file?: any;
  role?: Role;
  mode?: Mode;
}> = ({ file, role, mode }) => {
  return React.createElement('div', {
    style: {
      padding: '2rem',
      border: '2px dashed #666',
      borderRadius: '8px',
      backgroundColor: '#f5f5f5',
      color: '#333',
      fontFamily: 'monospace',
    }
  }, [
    React.createElement('h3', { key: 'title' }, 'No Renderer Registered'),
    React.createElement('div', { key: 'info', style: { marginTop: '1rem' } }, [
      React.createElement('div', { key: 'role' }, `Role: ${role || 'unknown'}`),
      React.createElement('div', { key: 'fileType' }, `File Type: ${file?.fileType || 'unknown'}`),
      React.createElement('div', { key: 'mode' }, `Mode: ${mode || 'unknown'}`),
    ]),
    React.createElement('div', { 
      key: 'message',
      style: { marginTop: '1rem', fontStyle: 'italic' } 
    }, 'Please register a renderer for this combination.'),
  ]);
};

/**
 * Get all registered renderers (for debugging/inspection)
 */
export function getAllRenderers(): RendererEntry[] {
  return [...registry];
}

/**
 * Clear all registered renderers (useful for testing)
 */
export function clearRegistry(): void {
  registry.length = 0;
}

// Made with Bob
