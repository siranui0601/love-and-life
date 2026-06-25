# Split and gravity motor policy

This branch moves generation toward unique physical motor roles instead of near-duplicate force kinds.

- `split` creates scoring clones.
- Clones can trigger split again.
- Clones can score goals and own goals.
- Clone falling does not fail the run.
- Main ball falling still fails the run.
- `gravityShift` means a temporary change to the gravity vector, not another upward force.
