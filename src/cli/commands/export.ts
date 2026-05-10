/**
 * 🐟 AZERCLAW Export Command
 * Export a session as a professional PDF "Mission Debrief".
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import PDFDocument from 'pdfkit';
import chalk from 'chalk';
const { getSessionStore } = require('../../memory/store');
const { fishBox, fishSuccess, fishError } = require('../animations/fish');

const EXPORTS_DIR = path.join(os.homedir(), '.azerclaw', 'exports');

export async function runExport(sessionId?: string): Promise<void> {
  const store = getSessionStore();
  
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }

  // 1. Resolve Session
  let session;
  if (!sessionId) {
    const recent = store.getRecent(1);
    if (recent.length === 0) {
      fishError('No sessions found to export.');
      return;
    }
    session = store.get(recent[0].id);
  } else {
    session = store.get(sessionId);
  }

  if (!session) {
    fishError(`Session "${sessionId}" not found.`);
    return;
  }

  // 2. Create PDF
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `mission_${session.id}_${Date.now()}.pdf`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Styling
  const primaryColor = '#7f1d1d'; // Vought Red
  const secondaryColor = '#171717'; // Dark Gray

  // Header
  doc.rect(0, 0, 612, 100).fill(primaryColor);
  doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('VOUGHT INTERNATIONAL', 50, 30);
  doc.fontSize(12).font('Helvetica').text('CLASSIFIED MISSION DEBRIEF', 50, 60);

  doc.moveDown(4);
  doc.fillColor('black').fontSize(18).font('Helvetica-Bold').text(`MISSION: ${session.title.toUpperCase()}`);
  doc.fontSize(10).font('Helvetica').text(`ID: ${session.id} | DATE: ${new Date(session.createdAt).toLocaleString()}`);
  
  doc.moveDown(1);
  doc.rect(50, doc.y, 512, 2).fill(secondaryColor);
  doc.moveDown(2);

  // Content
  for (const msg of session.messages) {
    if (msg.role === 'tool') continue; // Skip tool logs for the board report

    const role = msg.role.toUpperCase();
    const color = role === 'USER' ? '#2563eb' : primaryColor;

    doc.fillColor(color).font('Helvetica-Bold').fontSize(12).text(`${role}:`);
    doc.fillColor('#333333').font('Helvetica').fontSize(10).text(msg.content || '[Tool Calls Only]');
    
    if (msg.toolCalls) {
      doc.moveDown(0.5);
      doc.fillColor('#666666').font('Helvetica-Oblique').fontSize(8).text(`Tools utilized: ${msg.toolCalls.map((t: any) => t.function.name).join(', ')}`);
    }

    doc.moveDown(2);
    
    // Page break if near bottom
    if (doc.y > 700) doc.addPage();
  }

  // Footer
  doc.fontSize(8).fillColor('#999999').text('PROPRIETARY PROPERTY OF VOUGHT INTERNATIONAL. UNAUTHORIZED SHARING IS GROUNDS FOR IMMEDIATE TERMINATION.', 50, 750, { align: 'center' });

  doc.end();

  stream.on('finish', () => {
    fishBox('MISSION DEBRIEF GENERATED', [
      `  Session:  ${chalk.cyan(session.title)}`,
      `  File:     ${chalk.yellow(filePath)}`,
      '',
      chalk.dim('  Board-ready PDF report is ready for distribution.')
    ]);

    if (process.platform === 'darwin') {
      const { exec } = require('child_process');
      exec(`open "${filePath}"`);
    }
  });
}
