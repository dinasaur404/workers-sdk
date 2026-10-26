import { defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig(({ mode }) => ({
	worker: {
		name: "basics-unit-integration-self",
		compatibilityDate: "2026-10-19",
		// Required to use `exports.default.scheduled()` in tests. This is an
		// experimental compatibility flag, and cannot be enabled in production.
		compatibilityFlags:
			mode === "test" ? ["service_binding_extra_handlers"] : [],
		entrypoint,
	},
}));
