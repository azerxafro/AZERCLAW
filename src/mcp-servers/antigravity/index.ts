import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "antigravity-remote",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Open a file or directory in Antigravity IDE
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "antigravity_open",
        description: "Open a file or folder in Antigravity IDE",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The absolute path to open",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "antigravity_read_context",
        description: "Read Antigravity project context (AZERCLAW.md)",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "The root of the project",
            },
          },
          required: ["projectPath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "antigravity_open": {
      const targetPath = args?.path as string;
      try {
        await execAsync(`open -a "Antigravity" "${targetPath}"`);
        return {
          content: [{ type: "text", text: `Successfully opened ${targetPath} in Antigravity.` }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Failed to open in Antigravity: ${error.message}` }],
          isError: true,
        };
      }
    }

    case "antigravity_read_context": {
      const projectPath = args?.projectPath as string;
      const contextFile = path.join(projectPath, "AZERCLAW.md");
      try {
        const content = await fs.readFile(contextFile, "utf-8");
        return {
          content: [{ type: "text", text: content }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Project context not found at ${contextFile}` }],
          isError: true,
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Antigravity MCP Remote running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
