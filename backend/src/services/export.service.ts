import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import TurndownService from 'turndown';
import { getNoteTree, buildTreeStructure } from '../database/db.js';

const uploadsDir = process.env.UPLOADS_PATH || '/data/uploads';

interface NoteNode {
  id: number;
  parentId: number | null;
  title: string;
  titleEmoji: string | null;
  content: string;
  children: NoteNode[];
}

// Sanitize filename for filesystem
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'Untitled';
}

// Find all attachment references in HTML content
function findAttachments(html: string): string[] {
  const attachments: string[] = [];
  // Match /uploads/filename or /api/upload/serve/filename patterns
  const regex = /(?:\/uploads\/|\/api\/upload\/serve\/)([a-f0-9]+\.[a-z0-9]+)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    attachments.push(match[1]);
  }
  return [...new Set(attachments)]; // deduplicate
}

// Rewrite attachment URLs in content to relative paths
function rewriteAttachmentUrls(
  html: string,
  filesFolder: string
): string {
  return html
    .replace(/(?:\/uploads\/|\/api\/upload\/serve\/)([a-f0-9]+\.[a-z0-9]+)/gi, `./${filesFolder}/$1`);
}

// Wrap HTML content in a styled template
function wrapHtmlTemplate(title: string, emoji: string | null, content: string): string {
  const displayTitle = emoji ? `${emoji} ${title}` : title;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3, h4 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
    h1 { font-size: 2rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: monospace; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding-left: 1rem; color: #666; font-style: italic; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background-color: #f5f5f5; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

// Handle duplicate filenames in same directory
function resolveFilename(usedNames: Set<string>, baseName: string): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }
  const ext = path.extname(baseName);
  const name = path.basename(baseName, ext);
  let counter = 2;
  while (usedNames.has(`${name} (${counter})${ext}`)) {
    counter++;
  }
  const resolved = `${name} (${counter})${ext}`;
  usedNames.add(resolved);
  return resolved;
}

export async function exportNotes(
  userId: number,
  format: 'markdown' | 'html'
): Promise<Buffer> {
  // Get all notes as tree
  const flatNotes = getNoteTree(userId);
  const tree = buildTreeStructure(flatNotes) as NoteNode[];

  const zip = new AdmZip();
  const ext = format === 'markdown' ? '.md' : '.html';

  // Initialize turndown for markdown conversion
  let turndown: TurndownService | null = null;
  if (format === 'markdown') {
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    // Keep HTML tables as-is (markdown tables are limited)
    turndown.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  }

  // Recursively process notes
  function processNode(
    node: NoteNode,
    dirPath: string,
    usedNames: Set<string>
  ): void {
    const safeName = resolveFilename(usedNames, sanitizeFilename(node.title));
    const content = node.content || '';
    const attachments = findAttachments(content);
    const filesFolder = `${safeName}_files`;

    // Add attachments to zip
    if (attachments.length > 0) {
      for (const filename of attachments) {
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          const fileData = fs.readFileSync(filePath);
          zip.addFile(
            path.posix.join(dirPath, filesFolder, filename),
            fileData
          );
        }
      }
    }

    // Rewrite URLs in content and convert format
    let processedContent = attachments.length > 0
      ? rewriteAttachmentUrls(content, filesFolder)
      : content;

    if (format === 'markdown' && turndown) {
      processedContent = turndown.turndown(processedContent);
    } else if (format === 'html') {
      processedContent = wrapHtmlTemplate(node.title, node.titleEmoji, processedContent);
    }

    // Add note file
    zip.addFile(
      path.posix.join(dirPath, `${safeName}${ext}`),
      Buffer.from(processedContent, 'utf-8')
    );

    // Process children in a subfolder named after this note
    if (node.children.length > 0) {
      const childDir = path.posix.join(dirPath, safeName);
      const childUsedNames = new Set<string>();
      for (const child of node.children) {
        processNode(child, childDir, childUsedNames);
      }
    }
  }

  // Process root-level notes
  const rootUsedNames = new Set<string>();
  for (const node of tree) {
    processNode(node, '', rootUsedNames);
  }

  return zip.toBuffer();
}
