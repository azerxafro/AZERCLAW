/**
 * 🎨 Visual Evidence Tool
 * Uses Cloudflare Workers AI to generate diagrams, reports, and visual proof.
 */

import { Tool, ToolResult } from './registry';
import { getConfigManager } from '../config/manager';

export const generateImageTool: Tool = {
  name: 'generate_image',
  version: '2.0.0',
  description: 'Generate a visual diagram, report illustration, or conceptual image using Cloudflare Workers AI.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Detailed visual description' },
      aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '4:3'], default: '1:1' },
    },
    required: ['prompt'],
  },
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const config = getConfigManager().getAll();
    const custom = config.ai.providers.custom;
    
    if (!custom || !custom.apiKey || !custom.baseUrl) {
      return { success: false, output: '', error: 'Cloudflare credentials not configured' };
    }

    try {
      const fetch = require('node-fetch');
      const fs = require('fs/promises');
      const path = require('path');
      
      const response = await fetch(`${custom.baseUrl}/black-forest-labs/flux-1-schnell`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${custom.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: args.prompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI Error: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      const fileName = `evidence_${Date.now()}.png`;
      const filePath = path.join(process.cwd(), fileName);
      
      await fs.writeFile(filePath, buffer);
      
      return {
        success: true,
        output: `Image generated and saved to: ${filePath}\nPrompt: ${args.prompt}`,
        metadata: { filePath, fileName }
      };
    } catch (e: any) {
      return { success: false, output: '', error: e.message };
    }
  }
};
