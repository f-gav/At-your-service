# At your service! — Stage 4 / Rooms V2 / Bundle 3 of 5

## Audit: master workstation and concurrency

- Master can rename, close/reopen invites, remove other participants and delete their room. RLS owner policies enforce changes to room rows; a member can remove their own character. Players can change only their own `casts_enabled`.
- Existing client mutations used `update` / `delete` without returning affected rows. RLS-denied or concurrently changed rows could produce a successful response with no actual change.
- `busy` was React render state: multiple quick operations before a rerender could overlap.
- A stale browser tab could rename a newer title or reverse an already changed invitation setting.

## Fixes

- Synchronous ref lock serializes mutating room operations, closes same-tick double-click race.
- Mutating queries return changed identifiers via `.select()`. Zero changed rows become a visible conflict, not success.
- Title and closed state updates use expected-old-value predicates (compare-and-set); owner ID additionally filters master settings and deletion.
- Roll permission toggles check prior value and current user's membership. Delete membership returns affected row.
- On mutation error, fresh overview and room members are reloaded. Existing server RLS remains authoritative.

## Testing and constraints

`tests/stage4-rooms-master-actions.mjs` executes the affected-row guard and checks source-level operation, RLS, and query contracts. It runs in mandatory CI alongside all existing tests.

No production schema, migration, RLS, RPC, game rule, JSON, PDF or Storage change. Live two-user concurrent mutation testing and the actual deployed revision require separately verified acceptance. Bundle 4/5 will focus on player UX, multi-room switching and resource displays.
