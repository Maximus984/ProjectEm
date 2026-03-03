# LHE Sovereign Apex Roadmap

This workspace now includes a first implementation of the LHE Sovereign Apex diagnostic upgrades on top of ProjectM.

## Implemented in this update

- Adaptive-ready question metadata:
  - `difficulty` now supports 1-10.
  - `required_tools` and `metadata_tags` are included in diagnostic question payloads.
- Confidence tracking:
  - Students select confidence per question (`very_confident`, `somewhat_confident`, `guessing`).
  - Confidence is stored with answer-save telemetry.
  - Confidence Accuracy and Overconfidence Index are returned in post-submit results.
- Tool-enabled diagnostics:
  - Supported tools in contracts and telemetry:
    - `calculator`, `ruler`, `protractor`, `scratchpad`, `formula_sheet`, `graph_grid`
  - Tool open/close/use events are logged as immutable telemetry.
- Controlled break system:
  - Max 2 breaks per attempt.
  - Max 2 minutes per break.
  - Max 4 minutes total break time.
  - Breaks disabled in final 5 minutes.
  - Break auto-resume on time limit.
- 20-minute diagnostic timer:
  - UI now shows time remaining.
  - Attempt auto-submits when time expires.

## Next milestones for full Sovereign Apex scope

1. Adaptive engine runtime:
   - Move from fixed 20-question grade sets to dynamic next-question generation.
   - Server-authoritative difficulty progression and confidence-threshold early stop.
2. State test lockdown mode:
   - Fullscreen enforcement, copy/paste policy modes, right-click policy, stricter focus thresholds.
3. Cognitive mapping:
   - Processing speed, consistency index, confidence calibration trends, and cognitive heatmap API.
4. Parent/admin advanced analytics:
   - Difficulty progression charts, tool-usage charts, behavior timeline, session replay.
5. Business + tech simulation tracks:
   - Decision tree prompts, coding mini-challenges, strategy scoring rubrics.
6. Growth projection AI:
   - Multi-attempt trend projection and personalized follow-up plans after 3+ sessions.

