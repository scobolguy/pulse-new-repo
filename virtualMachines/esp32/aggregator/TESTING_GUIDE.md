# Testing Guide for User Management & Developer Features

## Quick Start

### 1. Start the Development Server

```bash
cd aggregator
npm run dev
```

The application should start on `http://localhost:5173`

### 2. Access the New Features

#### User Management Features
1. Click on the **User Admin** icon in the left sidebar (person icon)
2. You'll see new options in the submenu:
   - **Provisioner** - Create and submit user requests
   - **Verifier** - Approve/reject user requests
   - **Browser** - View users and audit history

#### Developer Features
1. Click on the **Develop** icon in the left sidebar (wrench icon)
2. The enhanced Developer Dashboard will open with 5 tabs:
   - **Editor** - Code editor (existing functionality)
   - **VM Inspector** - Debug VM state
   - **Test Harness** - Run tests
   - **Logs** - View development logs
   - **API Manager** - Browse API endpoints

## Testing Without Backend APIs

Since the backend APIs are not yet implemented, the components will show:
- Empty lists
- "No data available" messages
- API error messages in the status bar

This is expected behavior. The UI is fully functional and ready for backend integration.

## Mock Data Testing (Optional)

To test with mock data, you can temporarily modify the components to use local state instead of API calls.

### Example: Mock User Provisioner Data

Add this to `UserProvisioner.jsx` after the state declarations:

```javascript
// TEMPORARY MOCK DATA FOR TESTING
useEffect(() => {
  setUsers([
    { userId: 'test@example.com', email: 'test@example.com', displayName: 'Test User', enabled: true, profileIds: ['admin'] }
  ]);
  setProfiles([
    { profileId: 'admin', label: 'Administrator', permissions: ['*'] },
    { profileId: 'developer', label: 'Developer', permissions: ['develop.*'] }
  ]);
  setUserRequests([
    { userId: 'pending@example.com', email: 'pending@example.com', status: 'draft', displayName: 'Pending User' }
  ]);
}, []);
```

## Visual Testing Checklist

### User Provisioner
- [ ] Can see the three tabs (All Pending, Drafts, Submitted)
- [ ] "Create User Request" button is visible
- [ ] Form fields are present (Email, Display Name, Department, etc.)
- [ ] Profile checkboxes are visible
- [ ] Action buttons are present (Save Draft, Submit, Delete)
- [ ] Bilingual labels are displayed

### User Verifier
- [ ] Pending requests list is visible
- [ ] Request details panel shows all fields
- [ ] Verification checklist is displayed
- [ ] Three action buttons are present (Approve, Reject, Breakout)
- [ ] Reject dialog appears when clicking Reject
- [ ] Color coding is correct (green for approve, red for reject)

### User Profile Browser
- [ ] Search box is functional
- [ ] Filter dropdown works (All/Enabled/Disabled)
- [ ] User list displays correctly
- [ ] Two tabs are present (Details, Audit History)
- [ ] User details show in grid format
- [ ] Status badge displays correctly

### Developer Dashboard
- [ ] Five tabs are visible and clickable
- [ ] Editor tab shows the existing workspace
- [ ] VM Inspector shows state panels (Execution State, Stack, Variables)
- [ ] Test Harness shows "Run All Tests" button
- [ ] Logs tab shows terminal-style display
- [ ] API Manager shows endpoint list format

## Browser Console Testing

Open browser DevTools (F12) and check:

1. **No JavaScript Errors**: The console should be clean (except for expected API 404s)
2. **Component Mounting**: Components should mount without errors
3. **State Management**: React state updates should work smoothly

## Permission Testing

The components check for permissions. To test different permission levels:

1. **Full Access**: User with `*` permission
2. **User Management**: User with `users.*` or specific permissions
3. **Developer**: User with `develop.*` or `topology.read`
4. **No Access**: User without required permissions (should see error message)

## Expected API Calls (Will Fail Until Backend Implemented)

### User Management
```
GET  /api/users
GET  /api/users/profiles
GET  /api/users/requests
GET  /api/users/requests?status=pending-verification
POST /api/users/requests
GET  /api/users/:userId/audit
```

### Developer Tools
```
GET  /api/develop/vm/state
GET  /api/develop/tests/results
GET  /api/develop/logs?limit=100
GET  /api/develop/api-catalog
POST /api/develop/vm/step
POST /api/develop/vm/reset
POST /api/develop/tests/run
```

## Known Issues (Expected)

1. **API 404 Errors**: All API calls will fail until backend is implemented
2. **Empty Lists**: No data will display without backend
3. **Status Messages**: Will show "Load failed" messages
4. **Auto-refresh**: Will continue to attempt API calls

## Next Steps for Full Testing

1. **Implement Backend APIs**: See `USER_MANAGEMENT_DEVELOPER_IMPLEMENTATION.md` for API specifications
2. **Add Mock Server**: Use tools like `json-server` or `msw` for mock API responses
3. **Integration Testing**: Test full workflow once backend is ready
4. **E2E Testing**: Use Playwright or Cypress for automated testing

## Troubleshooting

### Components Not Showing
- Check browser console for import errors
- Verify all files are in `aggregator/src/`
- Ensure App.jsx imports are correct

### Styling Issues
- Check if App.css is loaded
- Verify theme classes are applied
- Check for CSS conflicts

### Permission Errors
- Check `actorPermissions` prop is passed correctly
- Verify permission strings match expected format
- Check user's profile assignments

## Success Criteria

✅ All components render without errors
✅ Navigation between tabs works smoothly
✅ Forms are interactive and responsive
✅ Buttons trigger appropriate actions
✅ Status messages display correctly
✅ Bilingual labels are visible
✅ Permission checks work as expected
✅ UI is responsive and accessible

## Contact

For issues or questions about the implementation, refer to:
- `USER_MANAGEMENT_DEVELOPER_IMPLEMENTATION.md` - Full implementation details
- `aggregator/src/` - Source code for all components
- Browser DevTools Console - For runtime errors