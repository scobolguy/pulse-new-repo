# GitHub issue board

Open `/issues` on the Aggregator frontend (normally `http://localhost:5173/issues`),
use its landing-page link, or run **Pulse: Open Issue Board** in Pulse Studio.
The board reads and edits Issues in `scobolguy/pulse-new-repo`; pull requests are
excluded. GitHub is the only persistent task store.

## Configuration and permissions

Provision a fine-grained GitHub token for this repository with **Issues: read and
write** access. Supply it privately as the backend environment variable
`PULSE_GITHUB_TOKEN`, then restart the backend. Never commit it or supply it in a
`VITE_*` variable. The token is used only by the backend against GitHub's API.
Repository labels are created when first needed; the credential must permit this.

Sign in with an existing Pulse user ID and password using the board's sign-in
form. It uses the existing Pulse session-token storage, not GitHub credentials.
Use HTTPS for remote access. Board reads require `governance.read`, and creation
and moves require `governance.manage`, reusing existing governance permissions.
Unlike development endpoints, these routes require a valid Pulse session and
resolve permissions without header-supplied user or group identities.

Missing configuration, invalid sessions, denied access, upstream failures, and
rate limits appear as errors, never as an empty successful board. All GitHub
pages are fetched; large histories can take longer. Refresh is manual or once
per minute while visible, with no concurrent frontend actions.

## Status conventions

| Column | GitHub label | Issue state |
| --- | --- | --- |
| Backlog | `status:backlog` | Open |
| In Progress | `status:in-progress` | Open |
| Blocked | `status:blocked` | Open |
| Done | `status:done` | Closed |

Unlabeled open issues appear in Backlog; closed issues appear in Done. Multiple
status labels or a label inconsistent with open/closed state show a conflict.
Select the intended status, or use **Confirm this status**, to correct it.
Moving a card preserves unrelated labels and assignees. Done closes the issue;
moving out of Done reopens it. Keyboard-accessible status controls are the primary
move mechanism; drag-and-drop is not required.

The backend checks the issue version before writing and submits labels and state
together. GitHub does not provide a transactional compare-and-swap for these
changes, so external edits can still race with a move. Refresh after a failure
before retrying; a lost response may mean GitHub already accepted the action.
In particular, inspect GitHub before retrying creation to avoid duplicates.

## Tracking work

Create one issue per confirmed actionable problem or common root cause. Include
reproduction, expected behavior, affected paths, acceptance checks, and dependency
issue links. Check both open and closed issues before creating a duplicate.
Use normal area labels where helpful; do not create an issue per failed assertion.

Track regression fixes, source cleanup, and the later portable C++ runtime
separately. **All regression failures must be resolved before native migration.**
The later runtime must coexist with Node.js and ESP32, not replace them globally.

## Validation

From the ESP32 workspace:

```powershell
node --test testing\aggregator\issues-board.test.mjs
```

From the Aggregator directory, run `npm run build`. With a frontend running, run
`node scripts\test-issues-board-ui.mjs` (or set `ISSUES_BOARD_URL` to its `/issues`
URL). The UI test mocks the API and does not create real GitHub issues. Recompile
the debugger extension before running its tests when Pulse Studio source changes.
