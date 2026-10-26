import assert from "node:assert";
import fsp from "node:fs/promises";
import path from "node:path";
import {
	BuildOutputError,
	readBuildOutput,
} from "@cloudflare/build-output-utils";
import { loadDevVars, loadEnv } from "@cloudflare/workers-utils/local-env";
import { resolveLocalBindings } from "./local-env";
import type { ModuleType } from "@cloudflare/config";
import type { WorkerOptions } from "miniflare";

/** An auxiliary Worker loaded from another project's build output. */
export interface BuildOutputWorkerOptions {
	buildOutput: {
		/**
		 * Root of the project that was built, which contains `.cloudflare/output`.
		 * Resolved relative to the Vitest project root.
		 */
		root: string;
		/** Name of the Worker to load. Defaults to the build's default Worker. */
		name?: string;
	};
}

/**
 * Reference a Worker in another project's build output, to run as an auxiliary
 * Worker. The build is read when tests start, so build the project first, for
 * example in `globalSetup`.
 *
 * @param root Root of the project that was built, relative to the Vitest
 * project root.
 * @param name Name of the Worker to load. Defaults to the build's default
 * Worker.
 * @returns An `auxiliaryWorkers` entry.
 */
export function buildOutputWorker(
	root: string,
	name?: string
): BuildOutputWorkerOptions {
	return { buildOutput: { root, name } };
}

/**
 * Load an auxiliary Worker from build output, in Miniflare's native shape.
 * Mirrors how `@cloudflare/vite-plugin` previews build output: local secrets
 * come from the built project's `.dev.vars`/`.env` files, in the build's mode.
 *
 * @param projectRoot The Vitest project root.
 * @param options The `auxiliaryWorkers` entry.
 * @returns The Worker's Miniflare options.
 */
export async function loadBuildOutputWorker(
	projectRoot: string,
	{ buildOutput }: BuildOutputWorkerOptions
): Promise<WorkerOptions> {
	const root = path.resolve(projectRoot, buildOutput.root);
	let output: Awaited<ReturnType<typeof readBuildOutput>>;
	try {
		output = await readBuildOutput(root);
	} catch (e) {
		if (!(e instanceof BuildOutputError)) {
			throw e;
		}
		throw new TypeError(
			`Couldn't load an auxiliary Worker from ${root}. Build the project first, for example in \`globalSetup\`.\n${e.message}`,
			{ cause: e }
		);
	}
	const { rootConfig, workers } = output;
	const worker =
		buildOutput.name === undefined
			? workers.default
			: Object.values(workers).find(
					(candidate) => candidate.config.name === buildOutput.name
				);
	if (worker === undefined) {
		throw new TypeError(
			`No Worker named "${buildOutput.name}" was found in the build output at ${root}.`
		);
	}
	const { manifest, assets, exports, env, ...config } = worker.config;
	if (manifest === undefined || worker.bundleDir === undefined) {
		throw new TypeError(
			`Worker "${config.name}" in the build output at ${root} has no bundle, so it can't run as an auxiliary Worker.`
		);
	}

	const mode = rootConfig.buildContext.mode;
	const [localEnv, devVars] = await Promise.all([
		loadEnv(root, mode),
		loadDevVars(root, mode),
	]);
	const { bindings, missingSecrets } = resolveLocalBindings(
		env,
		localEnv.values,
		devVars,
		/* remoteBindings */ false
	);
	const remoteBindings = Object.entries(env ?? {}).flatMap(([name, binding]) =>
		(binding as { dev?: { remote?: boolean } }).dev?.remote === true
			? [name]
			: []
	);
	if (remoteBindings.length > 0) {
		console.warn(
			`Auxiliary Workers don't support remote bindings, so ${remoteBindings.join(", ")} in Worker "${config.name}" run locally.`
		);
	}
	if (missingSecrets.length > 0) {
		console.warn(
			`Missing required secrets for Worker "${config.name}": ${missingSecrets.join(", ")}. Add them to \`.dev.vars\` or \`.env\` in ${root}.`
		);
	}

	const workerExports: NonNullable<WorkerOptions["config"]["exports"]> = {};
	for (const [name, exported] of Object.entries(exports ?? {})) {
		// Containers aren't supported by the pool
		const { container: _container, ...rest } = exported as typeof exported & {
			container?: string;
		};
		workerExports[name] = rest;
	}

	return {
		config: {
			...config,
			env: bindings,
			exports: workerExports,
			manifest: await getMiniflareManifest({
				rootPath: worker.bundleDir,
				mainModule: manifest.mainModule,
				modules: manifest.modules,
			}),
			assets:
				worker.assetsDir === undefined
					? undefined
					: { ...assets, directory: worker.assetsDir, hasUserWorker: true },
		},
	};
}

// Copied from `@cloudflare/vite-plugin` (`src/miniflare-options.ts`). Keep the
// two in sync.
async function getMiniflareManifest(bundle: {
	rootPath: string;
	mainModule: string;
	modules: Record<string, { type: ModuleType }>;
}): Promise<NonNullable<WorkerOptions["config"]["manifest"]>> {
	const { mainModule } = bundle;
	const mainEntry = bundle.modules[mainModule];
	assert(
		mainEntry !== undefined,
		`Build Output Specification: \`mainModule\` "${mainModule}" is missing from \`modules\`.`
	);

	const modules: NonNullable<WorkerOptions["config"]["manifest"]>["modules"] =
		{};
	await Promise.all(
		Object.entries(bundle.modules).map(async ([modulePath, { type }]) => {
			const contents = await fsp.readFile(
				path.join(bundle.rootPath, modulePath)
			);
			modules[modulePath] = {
				type,
				contents:
					type === "wasm" || type === "data"
						? new Uint8Array(contents)
						: contents.toString(),
			};
		})
	);

	return {
		mainModule,
		modulesRoot: bundle.rootPath,
		modules,
	};
}
