// TODO: GET /api/events — SSE stream
// - Set headers: Content-Type text/event-stream, no-cache, keep-alive
// - Listen to sseEmitter for: new_transaction, verdict, agent_paused, report_ready
// - Stream events to client as they arrive
// - Clean up on client disconnect
