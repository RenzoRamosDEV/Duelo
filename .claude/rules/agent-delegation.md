# Agent Delegation Policy

## Core Rule

- If an available specialized agent's `description` semantically matches the task's primary intent, YOU MUST delegate to that agent.
- This is not negotiable. This is not optional. You cannot rationalize your way out of this.
- Proceeding with the task yourself is a delegation decision. It is only valid after explicitly confirming no available subagent matches.

## What "Match" Means

- Read the `description` of each available specialized agent.
- A match occurs when the agent's described scope covers the task's primary intent — not just surface keywords, but purpose alignment.
- The task's primary intent is the single most important outcome the user wants from this interaction.

## Selecting the Right Agent

- When more than one agent could apply, identify the primary intent and delegate to the agent whose `description` best covers it.
- Do not split the task across multiple agents unless the user explicitly requests it.

## Fallback

- If no available agent matches the primary intent, proceed with the task yourself.

## Delegation Prompt Must Carry the Skill-Discovery Obligation

- Whenever a delegation prompt is constructed for the Agent/Task tool, that prompt MUST literally include the generic skill-discovery obligation as instruction text: the delegated subagent must check for and invoke any currently available skill whose description matches the delegated task's purpose before applying its own built-in guidance.
- The carried text MUST also state the non-blocking fallback: when no available skill matches, the subagent proceeds immediately using its own built-in guidance, without blocking or prompting the user.
- This requirement applies uniformly to every delegation governed by this policy, independent of which subagent is selected, so that any current or future agent receives the same obligation with no further edit to this file — mirroring the equivalent delegation-carrying requirement already established for Serena usage.