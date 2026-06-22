# noHand soccer UX rebuild notes

This branch focuses on usability after the first pitagora prototype.

## Main changes

- First view is now intentionally minimal: venue, ball, goal, and kickoff.
- The generation screen is locked until the first fall/tutorial moment.
- Tutorial flow now guides the player through kickoff, failure, generation, placement, editing, and retry.
- Gimmick placement is drag-first: drag a gimmick card onto the court, drag placed objects to move, and drag the round handle to rotate.
- Field emojis no longer use large circular backgrounds that can be mistaken for placed objects.
- Own-goal visuals are now red hazard gates, and failure uses a modal instead of tiny status text.
- Commentary/log UI has been removed from the primary interface.

## Still prototype

- The AI bridge is still represented by deterministic local template generation.
- Physics values and goal progression need tuning after phone testing.
