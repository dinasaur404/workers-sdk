# 🔁 workflows-exports

This Worker declares a `GreetingWorkflow` in the `exports` of `cloudflare.config.ts`. It has no binding, so the Worker reaches it through `ctx.exports.GreetingWorkflow`.

`introspectWorkflow()` needs a Workflow binding, so `cloudflare.config.ts` adds one to the same Workflow in `test` mode, which Vitest uses by default. Instances created through `ctx.exports` are introspected too.

| Test                                    | Overview                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| [exports.test.ts](test/exports.test.ts) | Runs the Workflow through `ctx.exports`, and introspects it through a test-only binding. |
