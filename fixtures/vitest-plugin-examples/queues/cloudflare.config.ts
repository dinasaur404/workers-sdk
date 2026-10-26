import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig(({ mode }) => ({
	worker: {
		name: "queues",
		compatibilityDate: "2026-10-19",
		// Required to use `exports.default.queue()` in tests. This is an
		// experimental compatibility flag, and cannot be enabled in production.
		compatibilityFlags:
			mode === "test" ? ["service_binding_extra_handlers"] : [],
		entrypoint,
		env: {
			QUEUE_RESULTS: bindings.kv({
				id: "00000000000000000000000000000000",
			}),
			QUEUE_PRODUCER: bindings.queue({ name: "queue" }),
		},
		triggers: [
			triggers.queue({
				name: "queue",
				// Use a shorter timeout in tests
				maxBatchTimeout: mode === "test" ? 0.05 /* 50ms */ : 3,
			}),
		],
	},
}));
