# Openspec Apply Command

When executing `/opsx-apply`:
0. Before reading any context or taking any other action: check available subagents. If any subagent's description covers the primary intent of this task, delegate to it immediately using the Task tool. The subagent takes over the full workflow from this point. Only continue to step 1 if no subagent matches.
1. Identify all subagents whose description semantically matches the task's primary intent. This is mandatory, not optional.
2. Delegate to the matching subagent(s). Subagents take priority over skills and over self-execution.
3. Each subagent MUST load and follow all applicable rules during its execution; per the Agent Delegation Policy's "Delegation Prompt Must Carry the Skill-Discovery Obligation" requirement, the delegation prompt constructed for the subagent MUST literally include the skill-discovery obligation text, rather than relying solely on this assertion.
4. If no subagent matches, fall back to direct execution with applicable skills loaded.


