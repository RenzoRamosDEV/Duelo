---
paths:
  - "**/*"
---

# Git Rules

## Initial Commit & Tagging
- **First Commit Requirement**: The very first commit on the `main` branch **MUST** have an annotated tag `v1.0.0-RC.0`.
  - Command: `git tag -a v1.0.0-RC.0 -m "chore: Initial release candidate"`

## Commit Message Format
- Follow the **Conventional Commits** specification (`<type>(<scope>): <description>`):
  - Example: `feat(auth): add JWT token validation`
- **Formatting**:
  - Use imperative present tense in descriptions (`add`, `fix`, `change`).
  - Keep the subject line under 72 characters.
  - Do not place a period at the end of the subject line.

## Branch Naming
- Use the structure `<type>/<kebab-case-description>` (e.g., `feat/add-user-login`).

## Safety & Hygiene
- **Secrets**: Never commit credentials, API keys, or `.env` files.
- **Atomic Commits**: Keep commits small, isolated, and focused on a single logical task.
