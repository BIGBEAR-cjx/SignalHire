# History Saved Views Collapse PRD

## Background

History saved views currently render every saved view chip inline. This works for a few saved views, but when recruiters save many views, the filter surface grows too tall and weakens scanability.

## Goal

Make saved views manageable when there are many views by showing a compact primary row and moving overflow into a controlled list/menu area.

## Users

- Recruiter who repeatedly applies common History filters.
- Agency operator who keeps multiple client, role, and needs-action views.

## Requirements

### P0

- Saving, applying, and deleting saved views must continue to use localStorage.
- No server-side saved view storage.
- Existing saved view serialization limit of 20 should remain.

### P1

- Show only a small number of saved view chips inline.
- When saved views exceed the inline limit, show a clear control to reveal the rest.
- Overflow views must still support apply and delete.
- The saved views area must not dominate the History filter surface on desktop or mobile.

### P2

- Keep the UI consistent with existing History filter controls.
- Avoid adding a modal or new navigation page.
- Preserve accessible labels for apply/delete actions.

## Non-Goals

- Saved view renaming.
- Saved view sharing.
- Foldering or server sync.

## UX Notes

- Inline views should represent the most recent saved views.
- Overflow should be explicit: users should know how many additional views are hidden.
- Deleting an overflow view should not close the entire History workflow or reset current filters.

## Acceptance Criteria

- With 0 saved views, no overflow control appears.
- With 1-4 saved views, all chips appear inline.
- With more than 4 saved views, only the first 4 appear inline and the rest are available behind an overflow control.
- Apply/delete behavior works for both inline and overflow views.
- `npm --prefix web run build` passes.

