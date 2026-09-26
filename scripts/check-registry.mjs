// Fails when r/ is stale against registry.json and the files it
// points at. Offline and dependency-free on purpose: `registry:build` shells
// out to npx, so this is the one that is cheap enough to run on every commit.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "r");

const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const stale = [];

const registry = read(path.join(ROOT, "registry.json"));

if (!existsSync(OUT)) {
	console.error("r/ is missing. Run `pnpm registry:build`.");
	process.exit(1);
}

const index = path.join(OUT, "registry.json");
if (!existsSync(index)) stale.push("r/registry.json is missing");

for (const item of registry.items) {
	const built = path.join(OUT, `${item.name}.json`);
	if (!existsSync(built)) {
		stale.push(`${item.name}.json is missing`);
		continue;
	}

	const out = read(built);

	for (const key of ["title", "description", "docs", "type"]) {
		if (JSON.stringify(item[key]) !== JSON.stringify(out[key])) {
			stale.push(`${item.name}: ${key} differs from registry.json`);
		}
	}

	const deps = item.registryDependencies ?? [];
	if (JSON.stringify(deps) !== JSON.stringify(out.registryDependencies ?? [])) {
		stale.push(`${item.name}: registryDependencies differ from registry.json`);
	}

	for (const file of item.files ?? []) {
		const embedded = (out.files ?? []).find((f) => f.path === file.path);
		if (!embedded) {
			stale.push(`${item.name}: ${file.path} is not in the built item`);
			continue;
		}
		if (embedded.content !== readFileSync(path.join(ROOT, file.path), "utf8")) {
			stale.push(`${item.name}: ${file.path} has changed since the last build`);
		}
	}
}

// `shadcn build` only ever writes, so an item that is renamed or removed
// leaves its old JSON behind, and the proxy keeps serving it.
const expected = new Set(["registry.json", ...registry.items.map((i) => `${i.name}.json`)]);
for (const file of readdirSync(OUT)) {
	if (!expected.has(file)) stale.push(`r/${file} is not built from any item; delete it`);
}

if (stale.length > 0) {
	console.error("Registry output is stale:\n");
	for (const line of stale) console.error(`  - ${line}`);
	console.error("\nRun `pnpm registry:build` and commit r/.");
	process.exit(1);
}

console.log(`Registry is up to date (${registry.items.length} items).`);
