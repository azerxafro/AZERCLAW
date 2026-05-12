import { marked, type MarkedExtension } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';

// marked-terminal v7's `markedTerminal()` returns a `MarkedExtension`-shaped object at
// runtime, but its bundled types narrow the return to `TerminalRenderer`. Cast to keep
// `marked.use()` happy without losing the runtime behavior.
marked.use(markedTerminal({
  // Customize styling to match AZERCLAW/Gemini CLI
  code: chalk.hex('#a78bfa'),
  blockquote: chalk.dim.italic,
  html: chalk.gray,
  heading: chalk.bold.hex('#818cf8'),
  firstHeading: chalk.bold.hex('#a855f7').underline,
  hr: chalk.dim.italic,
  listitem: chalk.hex('#e2e8f0'),
  table: chalk.hex('#e2e8f0'),
  paragraph: chalk.hex('#e2e8f0'),
  strong: chalk.bold.red,
  em: chalk.italic.hex('#93c5fd'),
  codespan: chalk.bgHex('#1e1e2f').hex('#fbbf24'),
  del: chalk.strikethrough.gray,
  link: chalk.hex('#3b82f6').underline,
  href: chalk.dim.underline,
  
  // Custom box around code blocks or just better coloring
  tab: 2,
}) as unknown as MarkedExtension);

export function renderMarkdown(text: string): string {
  if (!text) return '';
  // marked-terminal forces synchronous rendering — the result is always a string.
  return (marked.parse(text) as string).trim();
}
