export function log(message: string): void {
	process.stderr.write(`${message}\n`);
}
