# Engineering Policy — Mandatory TDD

If implementation starts without failing tests:
- Stop implementation
- Generate failing tests first

## Core Rule
No production code may be written before a failing test exists.

Mandatory workflow:
1. Red
2. Green
3. Refactor
4. Test

## Requirements

### Test Design
Apply:
- Equivalence Partitioning
- Boundary Value Analysis
- Golden File Testing
- Error Guessing
- Keep tests lightweight. Flag or timeout any test suite execution that hangs or takes too long.

### Test Double Strategy
Prefer:
1. Fakes
2. Mocks/Stubs
3. Spies
4. Testcontainers (last resort)

### Refactor Phase
When refactoring code during Step 3, engineers must adhere to industry-best clean code practices:
- **Boy Scout Rule:** Always leave the codebase cleaner than you found it. If you encounter messy code within the context of your changes, refactor it.
- **Single Responsibility Principle (SRP):** Ensure functions and classes have only one reason to change.
- **Self-Documenting Code:** Prioritize clear naming conventions over inline comments.

### Mutation Testing
Required target for modified code:
- Mutation score > 95%
- Otherwise justify surviving mutants
- Fail or abort the mutation analysis if it exceeds **3 minutes**.

> #### ⚠️ Scope Limitation Rule
> Mutation testing **must be executed exclusively on the scope of the current changes** (the diff you are actively working on). Do not run mutation testing across the entire project codebase, as this avoids unnecessary processing overhead and avoids failing builds on legacy sections of the codebase outside your immediate task.

## Enforcement
If implementation starts without failing tests:
- Stop implementation
- Generate failing tests first
