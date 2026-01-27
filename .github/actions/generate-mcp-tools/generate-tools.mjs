import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const README_PATH = path.join(ROOT, "README.md");
const TOOLS_DIR = path.join(ROOT, "src", "tools");

const START = "<!-- AUTO-GENERATED TOOLS START -->";
const END = "<!-- AUTO-GENERATED TOOLS END -->";

/**
 * Load MCP tools
 * Scans for any export that looks like an MCP tool:
 * {
 *   name: string,
 *   description: string,
 *   parameters?: ZodSchema
 *   schema?: JSONSchema
 * }
 */
async function loadTools() {
	const files = fs
		.readdirSync(TOOLS_DIR)
		.filter((f) => f.endsWith(".ts") && f !== "index.ts");

	const toolPromises = files.map(async (file) => {
		const mod = await import(path.join(TOOLS_DIR, file));

		const matches = Object.values(mod).filter(
			(exp) =>
				exp &&
				typeof exp === "object" &&
				typeof exp.name === "string" &&
				typeof exp.description === "string" &&
				(exp.parameters || exp.schema),
		);

		if (matches.length === 0) {
			return null;
		}

		if (matches.length > 1) {
			console.warn(
				`Warning: ${file} exports multiple MCP-like tools. Using the first one.`,
			);
		}

		return matches[0];
	});

	const loadedTools = await Promise.all(toolPromises);
	const tools = loadedTools.filter(Boolean);

	return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function renderSchema(schema) {
	if (!schema) {
		return "_No parameters_";
	}

	// If this is a Zod schema, convert it to JSON Schema
	const jsonSchema =
		typeof schema.safeParse === "function" ? zodToJsonSchema(schema) : schema;

	const properties = jsonSchema.properties ?? {};
	const required = new Set(jsonSchema.required ?? []);

	if (Object.keys(properties).length === 0) {
		return "_No parameters_";
	}

	// Check if any param has a default value to determine table columns
	const hasDefaults = Object.values(properties).some(
		(prop) => prop.default !== undefined,
	);

	// Build table header
	let table = hasDefaults
		? "| Parameter | Type | Required | Default | Description |\n|-----------|------|----------|---------|-------------|\n"
		: "| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n";

	// Build table rows
	for (const [key, prop] of Object.entries(properties)) {
		const type = Array.isArray(prop.type)
			? prop.type.join(" | ")
			: (prop.type ?? "unknown");

		const requiredStr = required.has(key) ? "✅" : "";
		const description = prop.description ?? "";
		const defaultVal =
			prop.default !== undefined ? JSON.stringify(prop.default) : "";

		if (hasDefaults) {
			table += `| \`${key}\` | ${type} | ${requiredStr} | ${defaultVal} | ${description} |\n`;
		} else {
			table += `| \`${key}\` | ${type} | ${requiredStr} | ${description} |\n`;
		}
	}

	return table.trim();
}

function renderMarkdown(tools) {
	let md = "";

	for (const tool of tools) {
		const schema = tool.parameters || tool.schema;

		md += `### \`${tool.name}\`\n`;
		md += `${tool.description}\n\n`;
		md += `${renderSchema(schema)}\n\n`;
	}

	return md.trim();
}

function updateReadme({ readme, tools }) {
	if (!readme.includes(START) || !readme.includes(END)) {
		throw new Error("README missing AUTO-GENERATED TOOLS markers");
	}

	const toolsMd = renderMarkdown(tools);

	return readme.replace(
		new RegExp(`${START}[\\s\\S]*?${END}`, "m"),
		`${START}\n\n${toolsMd}\n\n${END}`,
	);
}

async function main() {
	try {
		const readme = fs.readFileSync(README_PATH, "utf8");
		const tools = await loadTools();

		if (tools.length === 0) {
			console.warn("Warning: No tools found!");
		}

		const updated = updateReadme({ readme, tools });

		fs.writeFileSync(README_PATH, updated);
		console.log(`Synced ${tools.length} MCP tools to README.md`);
	} catch (error) {
		console.error("Error updating README:", error);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
