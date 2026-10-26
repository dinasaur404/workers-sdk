declare namespace Cloudflare {
	interface Env {
		// Bound only in tests, so the generated `Env` marks it optional
		GREETING_WORKFLOW: Workflow;
	}
}
