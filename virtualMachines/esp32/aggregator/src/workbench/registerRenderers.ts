// Register all example renderers with the renderer registry
import { registerRenderer } from './rendererRegistry';
import PascalishViewRenderer from './components/PascalishViewRenderer';
import PascalishDebugRenderer from './components/PascalishDebugRenderer';
import WFLViewRenderer from './components/WFLViewRenderer';
import WFLRunAnimatedRenderer from './components/WFLRunAnimatedRenderer';
import MapSpreadsheetRenderer from './components/MapSpreadsheetRenderer';
import MapDebugAnimatedRenderer from './components/MapDebugAnimatedRenderer';
import NodeCardRenderer from './components/NodeCardRenderer';

/**
 * Register all example renderers
 * This should be called once during application initialization
 */
export function registerAllRenderers(): void {
  // Pascalish renderers
  registerRenderer({
    role: 'developer',
    fileType: 'pascalish',
    mode: 'view',
    component: PascalishViewRenderer,
    priority: 10,
  });

  registerRenderer({
    role: 'developer',
    fileType: 'pascalish',
    mode: 'debug',
    component: PascalishDebugRenderer,
    priority: 10,
  });

  // WFL (Workflow) renderers
  registerRenderer({
    role: 'developer',
    fileType: 'wfl',
    mode: 'view',
    component: WFLViewRenderer,
    priority: 10,
  });

  registerRenderer({
    role: 'developer',
    fileType: 'wfl',
    mode: 'run',
    component: WFLRunAnimatedRenderer,
    priority: 10,
  });

  // Map (Data Mapping) renderers
  registerRenderer({
    role: 'dataMapper',
    fileType: 'map',
    mode: 'view',
    component: MapSpreadsheetRenderer,
    priority: 10,
  });

  registerRenderer({
    role: 'dataMapper',
    fileType: 'map',
    mode: 'debug',
    component: MapDebugAnimatedRenderer,
    priority: 10,
  });

  // Node renderers
  registerRenderer({
    role: 'analyst',
    fileType: 'node',
    mode: 'view',
    component: NodeCardRenderer,
    priority: 10,
  });

  console.log('✓ All workbench renderers registered');
}

// Made with Bob
