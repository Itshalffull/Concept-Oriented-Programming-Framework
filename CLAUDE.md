# COPF Project Conventions

## Naming & Comments

- **Never reference implementation phases or ordering** in code comments, file names, test names, or descriptions. Name and organize everything by logical function, not by what order it was implemented.
  - Bad: "Phase 19: Async Gate Tests", "Step 3 implementation"
  - Good: "Async Gate Convention & Pattern Validation Tests", "See Architecture doc Sections 16.11, 16.12"
- Comments should reference architecture doc section numbers (e.g., "Section 16.12") not phase numbers.
