const { marked } = require('marked');
const MarkedTerminalModule = require('marked-terminal');
const chalk = require('chalk');

// marked-terminal v7+ exports via ESM default; handle both CJS and ESM interop
const MarkedTerminal = MarkedTerminalModule.default || MarkedTerminalModule;

// Configure marked with the terminal renderer
const renderer = new MarkedTerminal({
  // Customize styling to match AZERCLAW/Gemini CLI
  header: chalk.bold.hex('#c4b5fd'),
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
  tab: 2
});

marked.use({ renderer });

export function renderMarkdown(text: string): string {
  if (!text) return '';
  // marked() returns a string when using marked-terminal
  return marked(text).trim();
}
