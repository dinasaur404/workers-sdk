# 📌 durable-objects-exports

This Worker mirrors the simple [`durable-objects`](../durable-objects/) fixture, but configures its Durable Objects via the declarative [`exports`](https://developers.cloudflare.com/durable-objects/reference/durable-object-exports) field in `cloudflare.config.ts`, including `UnboundCounter`, which is exported without a binding.

`Counter` is also declared as a regular binding under `durable_objects.bindings`. `UnboundCounter` has no binding and is reachable only via `ctx.exports.UnboundCounter` from inside the Worker — both forms must work for `exports` to be a full replacement for `migrations`.

| Test                                    | Overview                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| [exports.test.ts](test/exports.test.ts) | Bound + unbound DOs declared via `exports`, with SQLite storage and direct access. |
