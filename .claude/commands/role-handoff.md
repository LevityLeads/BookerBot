# /role:handoff - Role Handoff

Create a structured handoff document for passing work to another role or session.

## Handoff Template

Generate a handoff note with the following structure:

---

## Handoff: [Current Role] → [Next Role]

**Date:** [Today's date]
**Session:** [Brief description of what this session focused on]

### Completed Work

- [ ] List each task completed
- [ ] Include file paths modified
- [ ] Note any commits made

### Current State

**Files Modified:**
```
path/to/file1.ts - description of change
path/to/file2.ts - description of change
```

**Git Status:**
- Branch: [current branch]
- Last commit: [commit hash and message]
- Unpushed changes: [yes/no]

### Dependencies & Blockers

- Any external dependencies that need resolution
- Blockers that prevented completion
- Questions that need answers

### Recommended Next Steps

1. Prioritized list of what should happen next
2. Specific tasks for the next role
3. Any deadlines or urgency notes

### Context for Next Role

- Important decisions made and why
- Gotchas or edge cases discovered
- Related documentation to read

### Testing Notes

- What was tested
- What still needs testing
- Known issues or bugs

---

## Instructions

When generating a handoff:

1. **Review git status** - Check what's committed vs uncommitted
2. **List modified files** - Show what changed in this session
3. **Document decisions** - Explain why, not just what
4. **Be specific** - File paths, line numbers, function names
5. **Flag risks** - Anything that could break production

## Example Usage

After completing work on the AI engine:

```
## Handoff: AI Architect → QA Lead

**Date:** 2024-01-15
**Session:** Improved intent detection for time selection

### Completed Work
- [x] Added new regex patterns for time selection in intent-detector.ts
- [x] Updated booking-handler.ts to handle day abbreviations
- [x] Committed: "ai: improve time selection parsing"

### Current State
- All changes committed and pushed to main
- Build passing, lint clean

### Recommended Next Steps
1. Test new time patterns in AI Playground
2. Verify edge cases: "tues", "weds", "next monday"
3. Check that existing tests still pass

### Context
- Added DAY_VARIATIONS map to handle abbreviations
- Moved extraction logic to availability.ts for reuse
```

---

**Generate a handoff note for the work completed in this session.**
