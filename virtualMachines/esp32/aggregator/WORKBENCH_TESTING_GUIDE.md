# IBM BOB Workbench - Testing Guide

## Quick Start

The development server is now running. You can access:

- **Original GUI**: http://localhost:5174/ or http://localhost:5174/#/
- **Experimental Workbench**: http://localhost:5174/#/x

## Testing Checklist

### 1. Route Isolation Test
- [ ] Open http://localhost:5174/ - Should show the original GUI
- [ ] Open http://localhost:5174/#/x - Should show the IBM BOB Workbench
- [ ] Navigate between routes using browser back/forward buttons
- [ ] Verify both routes work independently without interference

### 2. Workbench UI Test
- [ ] Verify the top navigation bar displays correctly
- [ ] Check that role selector shows: developer, dataMapper, analyst, projectManager
- [ ] Check that file selector shows all sample files
- [ ] Check that mode selector shows: view, edit, run, debug, animate

### 3. Pascalish Renderer Tests

#### View Mode
- [ ] Select Role: developer, File: payment-router.pas, Mode: view
- [ ] Verify Monaco editor loads with syntax highlighting
- [ ] Check that line numbers are visible
- [ ] Verify the file content displays correctly

#### Debug Mode
- [ ] Select Role: developer, File: payment-router.pas, Mode: debug
- [ ] Verify current line (line 8) is highlighted in yellow
- [ ] Check debug panel on the right shows:
  - Registers: PC, SP, BP
  - Stack: [123, 'hello', true]
  - Variables: myLegacyMessage, output

### 4. WFL Renderer Tests

#### View Mode
- [ ] Select Role: developer, File: order-workflow.wfl, Mode: view
- [ ] Verify Mermaid state diagram renders
- [ ] Check that states are visible: Idle, Processing, Validation, Complete, Error
- [ ] Verify transitions are shown with arrows

#### Run Mode (Animated)
- [ ] Select Role: developer, File: order-workflow.wfl, Mode: run
- [ ] Verify the diagram animates (states highlight in green every 2 seconds)
- [ ] Check the execution state panel on the right shows:
  - Active States (updates as animation progresses)
  - Execution History (grows as states change)
- [ ] Verify the "RUNNING" badge pulses

### 5. Map Renderer Tests

#### View Mode
- [ ] Select Role: dataMapper, File: mt103-to-pain001.map, Mode: view
- [ ] Verify spreadsheet table displays with 3 columns:
  - Source Field (blue text)
  - Target Field (green text)
  - Transform (gray text)
- [ ] Check that all 5 mappings are visible
- [ ] Hover over rows to see highlight effect

#### Debug Mode
- [ ] Select Role: dataMapper, File: mt103-to-pain001.map, Mode: debug
- [ ] Verify current mapping (row 3) is highlighted in orange
- [ ] Check that previous mappings (rows 1-2) are highlighted in green
- [ ] Verify the debug panel on the right shows:
  - Current Mapping details (Source, Transform, Target)
  - Progress bar (60% for step 3 of 5)
- [ ] Check the visual flow: Source → Transform → Target with arrows

### 6. Node Renderer Test
- [ ] Select Role: analyst, File: payment-service, Mode: view
- [ ] Verify card layout displays with:
  - Service icon (⚙️)
  - Name: payment-service
  - Type badge: service
  - Status badge: ACTIVE (green)
  - Description text
  - Metadata table with 4 entries

### 7. Role Switching Test
- [ ] Start with developer role viewing payment-router.pas
- [ ] Switch to dataMapper role
- [ ] Verify the renderer changes appropriately
- [ ] Switch to analyst role
- [ ] Verify the renderer changes appropriately

### 8. Mode Switching Test
- [ ] Select payment-router.pas file
- [ ] Switch between view and debug modes
- [ ] Verify the renderer changes correctly
- [ ] Select order-workflow.wfl file
- [ ] Switch between view and run modes
- [ ] Verify animation starts/stops appropriately

### 9. File Switching Test
- [ ] Switch between all 4 sample files
- [ ] Verify each file renders correctly
- [ ] Check that file-specific content displays properly

### 10. Browser Compatibility Test
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Edge
- [ ] Verify consistent behavior across browsers

## Known Limitations (Stubs)

The following features are implemented as stubs and can be extended:

1. **WFL Parser**: Uses basic regex parsing, not full DSL parser
2. **Execution State**: Simulated with setTimeout, not real VM
3. **Debug State**: Static mock data, not real debugger
4. **Edit Mode**: Not yet implemented (view-only)
5. **Language Server**: Uses existing Pascalish LSP but not fully integrated for all features

## Troubleshooting

### Monaco Editor Not Loading
- Check browser console for errors
- Verify @monaco-editor/react is installed
- Clear browser cache and reload

### Mermaid Diagrams Not Rendering
- Check browser console for Mermaid errors
- Verify mermaid package is installed
- Try refreshing the page

### Routing Issues
- Ensure you're using hash-based URLs (#/x)
- Check browser console for Router errors
- Verify main.jsx is using Router component

### Type Errors
- Run `npm install` to ensure all dependencies are installed
- Check that TypeScript files compile without errors
- Verify all imports are correct

## Next Steps

After testing, consider:

1. Implementing real WFL parser
2. Connecting to actual P-code VM for execution
3. Adding edit mode with save functionality
4. Implementing more file types (COBOLish, Schema, etc.)
5. Adding collaborative features
6. Implementing breakpoints and step-through debugging

## Reporting Issues

If you encounter issues:

1. Check browser console for errors
2. Verify all files are created correctly
3. Ensure npm dependencies are installed
4. Check that the dev server is running
5. Document the steps to reproduce the issue

## Success Criteria

The implementation is successful if:

- ✅ Both routes (/ and /x) work independently
- ✅ All 7 renderer components display correctly
- ✅ Role/file/mode switching works smoothly
- ✅ Animations work (WFL run mode)
- ✅ Debug panels show correct information
- ✅ Monaco editor integrates properly
- ✅ Mermaid diagrams render correctly
- ✅ No console errors in normal operation