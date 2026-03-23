// Auto-generated entrypoint for suite "clef-devtools", target "mcp"
import { bootMcpServer } from '../../handlers/ts/framework/mcp-server.handler';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: tsx <entrypoint> <manifest-path>');
  process.exit(1);
}

await bootMcpServer(manifestPath);
