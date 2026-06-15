# IBM BOB Workbench - Implementation Documentation

## Overview

The IBM BOB Workbench is a role-based, file-type-based, mode-based rendering system that provides a pluggable architecture for displaying and interacting with different types of files in various modes.

## Architecture

### Core Components

1. **Renderer Registry** (`rendererRegistry.ts`)
   - Central registry for all renderer components
   - Maps (role, fileType, mode) → React component
   - Supports priority-based resolution
   - Provides fallback to DefaultRenderer

2. **Type Definitions** (`types.ts`)
   - TypeScript interfaces for all core types
   - Includes WorkflowEvent, ExecutionState, DebugState
   - Ensures type safety across the system

3. **WFL to Mermaid Converter** (`wflToMermaid.ts`)
   - Converts WFL DSL to Mermaid state diagrams
   - Stub implementation with basic parsing
   - Extensible for full WFL language support

### Renderer Components

#### Pascalish Renderers
- **PascalishViewRenderer**: Read-only code viewer with Monaco editor integration
  - Full language server support
  - Syntax highlighting
  - Type information from librarian
  
- **PascalishDebugRenderer**: Debug mode with execution state
  - Current line highlighting
  - Registers/Stack/Variables panel
  - Monaco editor integration

#### WFL (Workflow) Renderers
- **WFLViewRenderer**: Static workflow diagram
  - Mermaid-based visualization
  - Clean, professional layout
  
- **WFLRunAnimatedRenderer**: Animated execution
  - Real-time state highlighting
  - Execution history panel
  - Active state tracking

#### Map (Data Mapping) Renderers
- **MapSpreadsheetRenderer**: Spreadsheet-style table view
  - Source → Transform → Target columns
  - Clean, readable layout
  
- **MapDebugAnimatedRenderer**: Animated mapping debugger
  - Step-by-step execution
  - Current mapping highlighting
  - Progress tracking

#### Node Renderer
- **NodeCardRenderer**: Card-based node information display
  - Status indicators
  - Metadata display
  - Type-specific icons

### Mermaid Integration

**MermaidRenderer** (`components/MermaidRenderer.jsx`)
- Renders Mermaid diagrams
- Supports active state highlighting
- CSS-based animation
- Re-renders on state changes

## Usage

### Accessing the Workbench

- **Original GUI**: `http://localhost:5173/` or `http://localhost:5173/#/`
- **Experimental Workbench**: `http://localhost:5173/#/x`

The routing is hash-based, so both UIs can coexist without conflicts.

### Registering a New Renderer

```typescript
import { registerRenderer } from './workbench/rendererRegistry';
import MyCustomRenderer from './components/MyCustomRenderer';

registerRenderer({
  role: 'myRole',
  fileType: 'myFileType',
  mode: 'myMode',
  component: MyCustomRenderer,
  priority: 10, // Optional, default is 0
});
```

### Creating a Custom Renderer

```jsx
import React from 'react';

const MyCustomRenderer = ({ file, role, mode, executionState, debugState }) => {
  return (
    <div>
      <h1>{file.name}</h1>
      <p>Role: {role}, Mode: {mode}</p>
      {/* Your custom rendering logic */}
    </div>
  );
};

export default MyCustomRenderer;
```

### Renderer Props

All renderers receive the following props:

- `file`: File data object with `fileType`, `content`, `name`, etc.
- `role`: Current user role (string)
- `mode`: Current mode (string)
- `executionState`: (Optional) Execution state for animated renderers
  - `activeStates`: Array of active state IDs
  - `history`: Array of WorkflowEvent objects
- `debugState`: (Optional) Debug state for debug renderers
  - `currentLine`: Current line number
  - `registers`: Register values
  - `stack`: Stack contents
  - `variables`: Variable values
  - `currentStep`: Current step number

## Resolution Rules

The renderer registry uses the following resolution order:

1. **Exact match**: role + fileType + mode
2. **Partial match**: fileType + mode (any role)
3. **Fallback**: fileType only (any role, any mode)
4. **Default**: DefaultRenderer (shows "No renderer registered")

When multiple renderers match, the one with the highest priority is selected.

## File Types

Currently supported file types:

- `pascalish`: Pascalish business logic language
- `wfl`: Workflow FSM language
- `map`: Data mapping DSL
- `node`: Node/service metadata
- `cobolish`: COBOL-style record logic (extensible)
- `schema`: Data schema definitions (extensible)

## Modes

Currently supported modes:

- `view`: Read-only viewing
- `edit`: Editing mode (extensible)
- `run`: Execution/animation mode
- `debug`: Debug mode with state inspection
- `animate`: Animation mode (extensible)
- `inspect`: Inspection mode (extensible)
- `diff`: Diff/comparison mode (extensible)

## Roles

Currently supported roles:

- `developer`: Software developers
- `dataMapper`: Data mapping specialists
- `analyst`: Business analysts
- `projectManager`: Project managers (extensible)
- `dataLibrarian`: Data librarians (extensible)

## Extension Points

### Adding New File Types

1. Create renderer components for the new file type
2. Register them in `registerRenderers.ts`
3. Add sample files to `Workbench.jsx` for testing

### Adding New Modes

1. Create mode-specific renderer variants
2. Register with appropriate mode parameter
3. Update mode selector in `Workbench.jsx`

### Adding New Roles

1. Create role-specific renderer variants (if needed)
2. Register with appropriate role parameter
3. Update role selector in `Workbench.jsx`

## Testing

### Sample Files

The workbench includes sample files for each file type:
- `payment-router.pas` (Pascalish)
- `order-workflow.wfl` (WFL)
- `mt103-to-pain001.map` (Map)
- `payment-service` (Node)

### Testing Scenarios

1. **Role switching**: Change roles and verify appropriate renderers load
2. **Mode switching**: Change modes and verify behavior changes
3. **File switching**: Change files and verify correct rendering
4. **Animation**: Test WFL run mode for animated state transitions
5. **Debug**: Test debug modes for state inspection

## Integration with Existing System

The workbench integrates with:

- **Monaco Editor**: For code editing with language server support
- **Mermaid**: For workflow visualization
- **Librarian API**: For type and schema information
- **Pascalish Language Server**: For code intelligence

## Future Enhancements

Potential areas for expansion:

1. **Edit Mode**: Full editing support with save functionality
2. **Real VM Integration**: Connect to actual P-code VM for execution
3. **Collaborative Features**: Multi-user editing and viewing
4. **More DSLs**: COBOLish, Schema DSL, etc.
5. **Advanced Debugging**: Breakpoints, step-through, watches
6. **Visual Editors**: Drag-and-drop for WFL and Map DSLs
7. **Diff Mode**: Side-by-side comparison of files
8. **History**: Version history and time-travel debugging

## Performance Considerations

- Renderers are lazy-loaded where possible
- Monaco editor is loaded on-demand
- Mermaid diagrams are rendered once and cached
- State updates use React's efficient reconciliation

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## License

Part of the IBM BOB system.