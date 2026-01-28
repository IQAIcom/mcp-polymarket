import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const README_PATH = path.join(ROOT, "README.md");
const TOOLS_DIR = path.join(ROOT, "src", "tools");

const START = "<!-- AUTO-GENERATED TOOLS START -->";
const END = "<!-- AUTO-GENERATED TOOLS END -->";

/**
 * Parse a Zod schema definition from source code to extract parameter info
 */
function parseZodSchemaFromSource(source, schemaName) {
	const params = [];

	// Find the schema definition - look for z.object({ ... }) or z\n.object({
	// Handle whitespace/newlines between z and .object
	const schemaStartRegex = new RegExp(
		`(?:const|let|var)\\s+${schemaName}\\s*=\\s*z\\s*\\.\\s*object\\s*\\(\\s*\\{`,
		"ms",
	);
	const startMatch = source.match(schemaStartRegex);
	if (!startMatch) return params;

	// Find the matching closing brace
	const startIndex = startMatch.index + startMatch[0].length;
	let braceCount = 1;
	let endIndex = startIndex;

	for (let i = startIndex; i < source.length && braceCount > 0; i++) {
		if (source[i] === "{") braceCount++;
		if (source[i] === "}") braceCount--;
		endIndex = i;
	}

	const schemaBody = source.substring(startIndex, endIndex);

	// Find all parameters by looking for "paramName: z" pattern (z can be on same or next line)
	const lines = schemaBody.split("\n");
	let currentParam = null;
	let currentContent = "";

	for (const line of lines) {
		// Check if this line starts a new parameter
		// Pattern: "paramName: z" or "paramName: z.something"
		const paramStart = line.match(/^\s*(\w+)\s*:\s*z\.?/);
		if (paramStart) {
			// Save previous param if exists
			if (currentParam && currentContent) {
				const parsed = parseParamContent(currentParam, currentContent);
				if (parsed && !parsed.name.startsWith("_")) {
					params.push(parsed);
				}
			}
			currentParam = paramStart[1];
			currentContent = line;
		} else if (currentParam) {
			currentContent += `\n${line}`;
		}
	}

	// Don't forget the last parameter
	if (currentParam && currentContent) {
		const parsed = parseParamContent(currentParam, currentContent);
		if (parsed && !parsed.name.startsWith("_")) {
			params.push(parsed);
		}
	}

	return params;
}

/**
 * Parse a single parameter's content to extract type, description, etc.
 */
function parseParamContent(name, content) {
	// Extract description from .describe("...") - handle multi-line descriptions
	// Use a more robust approach: find .describe( then match the string
	const descStartMatch = content.match(/\.describe\s*\(\s*/);
	if (!descStartMatch) return null;

	const descStartIndex = descStartMatch.index + descStartMatch[0].length;
	const afterDescribe = content.substring(descStartIndex);

	// Find the quote character used
	const quoteChar = afterDescribe[0];
	if (!["'", '"', "`"].includes(quoteChar)) return null;

	// Find the closing quote (handle escaped quotes)
	let description = "";
	let i = 1;
	while (i < afterDescribe.length) {
		if (afterDescribe[i] === "\\") {
			// Escaped character - include both
			description += afterDescribe[i] + (afterDescribe[i + 1] || "");
			i += 2;
		} else if (afterDescribe[i] === quoteChar) {
			// End of string
			break;
		} else {
			description += afterDescribe[i];
			i++;
		}
	}

	// Clean up the description (remove extra whitespace from multi-line)
	description = description.replace(/\s+/g, " ").trim();

	// Extract type from z.type() - look for the first method call after z.
	// Common types: string, number, boolean, array, object, enum, union
	const typeMatch = content.match(/z\.\s*\n?\s*\.?(\w+)\s*\(/);
	let baseType = typeMatch ? typeMatch[1] : "unknown";

	// If we got something weird, try another pattern
	if (
		baseType === "unknown" ||
		![
			"string",
			"number",
			"boolean",
			"array",
			"object",
			"enum",
			"union",
			"literal",
		].includes(baseType)
	) {
		const altMatch = content.match(
			/\.\s*(string|number|boolean|array|object|enum|union)\s*\(/,
		);
		if (altMatch) baseType = altMatch[1];
	}

	// Check for optional
	const isOptional = content.includes(".optional()");

	// Check for default and extract value
	const hasDefault = content.includes(".default(");
	let defaultValue;
	if (hasDefault) {
		const defaultMatch = content.match(/\.default\(\s*(.+?)\s*\)/);
		if (defaultMatch) {
			let val = defaultMatch[1].trim();
			// Clean up the value
			if (val.startsWith('"') || val.startsWith("'") || val.startsWith("`")) {
				val = val.slice(1, -1);
			}
			defaultValue = val;
		}
	}

	return {
		name,
		type: baseType,
		description,
		required: !isOptional && !hasDefault,
		default: defaultValue,
	};
}

/**
 * Extract tool description from source using a more robust method
 */
function extractDescription(source, startIndex, endIndex) {
	const searchArea = source.substring(startIndex, endIndex);
	const descMatch = searchArea.match(/description\s*:\s*["'`]/);
	if (!descMatch) return null;

	const descStartIndex = descMatch.index + descMatch[0].length - 1;
	const quoteChar = searchArea[descStartIndex];
	const afterQuote = searchArea.substring(descStartIndex + 1);

	// Find the closing quote (handle escaped quotes)
	let description = "";
	let i = 0;
	while (i < afterQuote.length) {
		if (afterQuote[i] === "\\") {
			// Escaped character - skip the backslash but include the char
			description += afterQuote[i + 1] || "";
			i += 2;
		} else if (afterQuote[i] === quoteChar) {
			// End of string
			break;
		} else {
			description += afterQuote[i];
			i++;
		}
	}

	return description.trim();
}

/**
 * Parse tool definition from source code
 */
function parseToolFromSource(source, filePath) {
	const tools = [];

	// Find all tool-like exports by looking for name: "some_name" or "SOME_NAME" pattern
	const nameMatches = [
		...source.matchAll(/name\s*:\s*["'`]([a-zA-Z][a-zA-Z0-9_]+)["'`]/g),
	];

	for (const nameMatch of nameMatches) {
		const name = nameMatch[1];
		const nameIndex = nameMatch.index;

		// Find the description using robust extraction
		const description = extractDescription(
			source,
			Math.max(0, nameIndex - 200),
			nameIndex + 800,
		);

		if (!description) continue;

		// Find the parameters schema name
		const searchArea = source.substring(
			Math.max(0, nameIndex - 200),
			nameIndex + 500,
		);
		const paramsMatch = searchArea.match(/parameters\s*:\s*(\w+)/);
		const params = paramsMatch
			? parseZodSchemaFromSource(source, paramsMatch[1])
			: [];

		// Avoid duplicates
		if (!tools.some((t) => t.name === name)) {
			tools.push({
				name,
				description,
				params,
				source: filePath,
			});
		}
	}

	return tools;
}

/**
 * Check if value is an MCP tool object
 */
function isMcpTool(exp) {
	return (
		exp &&
		typeof exp === "object" &&
		typeof exp.name === "string" &&
		typeof exp.description === "string" &&
		(exp.parameters || exp.schema)
	);
}

/**
 * Check if a schema is a Zod v4 schema
 */
function isZodV4(schema) {
	return schema && typeof schema === "object" && schema._zod?.def?.type;
}

/**
 * Extract the base type from a Zod v4 schema property
 */
function extractZodV4BaseType(prop) {
	if (!prop) return { type: "unknown" };
	const def = prop._zod?.def || prop.def;
	if (!def) {
		if (prop.type) return { type: prop.type };
		return { type: "unknown" };
	}
	const wrapperType = def.type;
	if (wrapperType === "default" || wrapperType === "optional") {
		const inner = def.innerType;
		const baseInfo = extractZodV4BaseType(inner);
		if (wrapperType === "default") baseInfo.default = def.defaultValue;
		if (wrapperType === "optional") baseInfo.optional = true;
		return baseInfo;
	}
	switch (wrapperType) {
		case "string":
			return { type: "string" };
		case "number":
			return { type: "number" };
		case "boolean":
			return { type: "boolean" };
		case "enum":
			return {
				type: "string",
				enum: def.entries ? Object.keys(def.entries) : [],
			};
		case "array":
			return { type: "array" };
		case "object":
			return { type: "object" };
		default:
			return { type: wrapperType || "unknown" };
	}
}

/**
 * Convert Zod v4 schema to JSON Schema format
 */
function zodV4ToJsonSchema(schema) {
	const def = schema._zod?.def;
	if (!def || def.type !== "object") return { properties: {}, required: [] };
	const shape = def.shape || {};
	const properties = {};
	const required = [];
	for (const [key, prop] of Object.entries(shape)) {
		const typeInfo = extractZodV4BaseType(prop);
		properties[key] = {
			type: typeInfo.type,
			description: prop.description || "",
		};
		if (typeInfo.enum) properties[key].enum = typeInfo.enum;
		if (typeInfo.default !== undefined)
			properties[key].default = typeInfo.default;
		if (!typeInfo.optional && typeInfo.default === undefined)
			required.push(key);
	}
	return { properties, required };
}

/**
 * Convert Zod schema to JSON Schema
 */
async function zodToJsonSchema(schema) {
	if (isZodV4(schema)) return zodV4ToJsonSchema(schema);
	if (schema && typeof schema.safeParse === "function") {
		try {
			const { zodToJsonSchema: zodV3ToJsonSchema } = await import(
				"zod-to-json-schema"
			);
			return zodV3ToJsonSchema(schema);
		} catch {
			return { properties: {}, required: [] };
		}
	}
	return schema;
}

/**
 * Load MCP tools - tries dynamic import first, falls back to source parsing
 */
async function loadTools() {
	const tools = [];
	const files = fs
		.readdirSync(TOOLS_DIR)
		.filter((f) => f.endsWith(".ts") && f !== "index.ts");

	for (const file of files) {
		const filePath = path.join(TOOLS_DIR, file);

		// Try dynamic import first
		try {
			const mod = await import(filePath);
			const matches = Object.values(mod).filter(isMcpTool);

			for (const tool of matches) {
				const schema = tool.parameters || tool.schema;
				const jsonSchema = await zodToJsonSchema(schema);
				tools.push({
					name: tool.name,
					description: tool.description,
					jsonSchema,
				});
			}

			if (matches.length > 0) {
				console.log(`Loaded ${matches.length} tool(s) from ${file} via import`);
				continue;
			}
		} catch (err) {
			console.warn(`Import failed for ${file}: ${err.message.split("\n")[0]}`);
		}

		// Fallback to source parsing
		try {
			const source = fs.readFileSync(filePath, "utf8");
			const parsedTools = parseToolFromSource(source, file);

			for (const tool of parsedTools) {
				const properties = {};
				const required = [];

				for (const param of tool.params) {
					properties[param.name] = {
						type: param.type,
						description: param.description,
					};
					if (param.default !== undefined) {
						properties[param.name].default = param.default;
					}
					if (param.required) {
						required.push(param.name);
					}
				}

				tools.push({
					name: tool.name,
					description: tool.description,
					jsonSchema: { properties, required },
				});
			}

			if (parsedTools.length > 0) {
				console.log(
					`Parsed ${parsedTools.length} tool(s) from ${file} via source`,
				);
			}
		} catch (err) {
			console.warn(`Source parsing failed for ${file}: ${err.message}`);
		}
	}

	return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function renderSchema(jsonSchema) {
	const properties = jsonSchema?.properties ?? {};
	const required = new Set(jsonSchema?.required ?? []);

	const publicProperties = Object.entries(properties).filter(
		([key]) => !key.startsWith("_"),
	);
	if (publicProperties.length === 0) return "_No parameters_";

	const hasDefaults = publicProperties.some(
		([, prop]) => prop.default !== undefined,
	);

	let table = hasDefaults
		? "| Parameter | Type | Required | Default | Description |\n|-----------|------|----------|---------|-------------|\n"
		: "| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n";

	for (const [key, prop] of publicProperties) {
		const type = Array.isArray(prop.type)
			? prop.type.join(" | ")
			: (prop.type ?? "unknown");
		const requiredStr = required.has(key) ? "✅" : "";
		const description = prop.description ?? "";
		const defaultVal =
			prop.default !== undefined ? String(prop.default) : "";

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
		md += `### \`${tool.name}\`\n`;
		md += `${tool.description}\n\n`;
		md += `${renderSchema(tool.jsonSchema)}\n\n`;
	}
	return md.trim();
}

function updateReadme({ readme, toolsMd }) {
	if (!readme.includes(START) || !readme.includes(END)) {
		throw new Error("README missing AUTO-GENERATED TOOLS markers");
	}
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

		const toolsMd = renderMarkdown(tools);
		const updated = updateReadme({ readme, toolsMd });

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
