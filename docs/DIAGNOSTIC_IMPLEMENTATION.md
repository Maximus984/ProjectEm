# Diagnostic Testing System (Grades 7-12)

## Scope implemented
- Runtime action endpoint for `get_questions`, `record_event`, `submit_attempt`, `get_answers`, `reassign_attempt`
- Question bank: 20 questions per grade for grades 7, 8, 9, 10, 11, 12 (120 total)
- Telemetry event capture with immutable append-only event table
- Break flow with limits (`2` breaks, `600` seconds total)
- Speeding, AI/copy similarity heuristics, effort, engagement, and integrity scoring
- Admin/proctor actions: reassign, mark reviewed, lock student, generate parent report
- Student-safe summary + TTS summary endpoint
- Admin/proctor full review endpoint with flags and evidence

## Runtime payload examples
```json
{ "action": "get_questions", "grade": 7 }
```

```json
{
  "action": "record_event",
  "event": {
    "event_type": "attempt_start",
    "attempt_id": "att_123",
    "student_id": "student@example.com",
    "grade": 7,
    "test_id": "projectm_diagnostic_v1",
    "start_time": "2026-03-03T20:00:00.000Z",
    "userAgent": "Mozilla/5.0"
  }
}
```

```json
{
  "action": "record_event",
  "event": {
    "event_type": "answer_save",
    "attempt_id": "att_123",
    "question_id": "q0701",
    "answer": "Central Processing Unit",
    "time": "2026-03-03T20:01:30.000Z",
    "is_final": false,
    "paste_event": false
  }
}
```

```json
{
  "action": "submit_attempt",
  "attempt_id": "att_123"
}
```

## API endpoints
- `POST /api/v1/diagnostic/runtime`
- `GET /api/v1/diagnostic/attempts/:attemptCode/results-summary`
- `GET /api/v1/diagnostic/admin/attempts/:attemptCode`
- `POST /api/v1/diagnostic/admin/attempts/:attemptCode/reassign`
- `POST /api/v1/diagnostic/admin/attempts/:attemptCode/mark_reviewed`
- `POST /api/v1/diagnostic/admin/attempts/:attemptCode/send_parent_report`
- `POST /api/v1/diagnostic/admin/attempts/:attemptCode/lock_student`

## Student UI route
- `GET /diagnostic` (authenticated)

## Key rules enforced
- Student responses never include integrity/suspicion labels.
- Attempts become immutable after submission.
- Telemetry uses append-only event writes.
- Parent report uses neutral wording (`Flagged for Review`, no accusation labels).
- Diagnostic event payloads are encrypted before DB persistence.

## TTS
- Browser Web Speech API is used on the diagnostics page for reading student-safe summary text.
- See [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).

## Optional embeddings hook
- OpenAI embedding helper is scaffolded in:
  - `apps/api/src/modules/diagnostics/embeddings.ts`
- Endpoint used:
  - `POST https://api.openai.com/v1/embeddings` with model `text-embedding-3-small`
