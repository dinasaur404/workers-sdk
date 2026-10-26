import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig(({ mode }) => ({
	worker: {
		name: "workflows-exports",
		compatibilityDate: "2026-10-19",
		entrypoint,
		// `GreetingWorkflow` is bound only in tests, so they can introspect it.
		// Otherwise it's reachable only via `ctx.exports.GreetingWorkflow` from
		// inside the Worker.
		env:
			mode === "test"
				? {
						GREETING_WORKFLOW: bindings.workflow({
							name: "greeting-workflow",
							worker: "workflows-exports",
							exportName: "GreetingWorkflow",
						}),
					}
				: {},
		exports: {
			GreetingWorkflow: exports.workflow({ name: "greeting-workflow" }),
		},
	},
}));
