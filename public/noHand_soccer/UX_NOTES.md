# noHand soccer UX rebuild notes

This prototype prioritizes first-run usability.

## Current onboarding design

- The first screen only explains the core action: press kickoff and guide the ball into the yellow goal.
- Tutorial mode starts with only the ball and the first goal. Field emojis and own-goals stay hidden until after the first successful goal.
- The first fall unlocks the generation tab and explains why gimmicks are needed.
- A generated gimmick returns the player to the venue and teaches drag placement.
- When the first goal is cleared, the ball returns to the start, a new goal appears, the camera shows it, then field emojis appear with an explanation.

## Interaction model

- Kickoff mode: the ball is moving and placement is disabled.
- Non-kickoff mode: gimmicks can be placed, moved, and rotated directly on the court.
- There is no separate edit button; being outside kickoff is the edit state.
- Field emojis are materials. The ball collects them by touching them.

## Still prototype

- The AI bridge is still represented by deterministic local template generation.
- Physics values and goal progression need phone testing.
