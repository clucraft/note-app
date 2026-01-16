import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { marked } from 'marked';
import { db } from '../database/db.js';

export interface ImportOptions {
  userId: number;
  parentId?: number | null;
  preserveStructure: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: {
    notes: number;
    attachments: number;
  };
  errors: Array<{ file: string; error: string }>;
  rootNoteIds: number[];
}

interface FileEntry {
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  content?: string;
}

interface NoteData {
  title: string;
  titleEmoji: string | null;
  content: string;
  relativePath: string;
  children: NoteData[];
}

const uploadsDir = process.env.UPLOADS_PATH || '/data/uploads';

/**
 * Process a Docmost export (files or ZIP)
 */
export async function processDocmostImport(
  files: Express.Multer.File[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: { notes: 0, attachments: 0 },
    errors: [],
    rootNoteIds: []
  };

  try {
    // Separate ZIP files from regular files
    const zipFiles = files.filter(f => f.originalname.endsWith('.zip'));
    const regularFiles = files.filter(f => !f.originalname.endsWith('.zip'));

    // Process ZIP files
    for (const zipFile of zipFiles) {
      await processZipFile(zipFile, options, result);
    }

    // Process regular files (direct uploads)
    if (regularFiles.length > 0) {
      await processRegularFiles(regularFiles, options, result);
    }

    result.success = result.errors.length === 0;
  } catch (error: any) {
    result.success = false;
    result.errors.push({ file: 'general', error: error.message });
  }

  return result;
}

/**
 * Process a ZIP file containing Docmost export
 */
async function processZipFile(
  zipFile: Express.Multer.File,
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  const zip = new AdmZip(zipFile.path);
  const entries = zip.getEntries();

  // Build file tree from ZIP entries
  const fileEntries: FileEntry[] = [];
  const tempDir = path.join(path.dirname(zipFile.path), `extract_${Date.now()}`);

  // Extract ZIP to temp directory
  zip.extractAllTo(tempDir, true);

  // Walk through extracted files
  await walkDirectory(tempDir, tempDir, fileEntries);

  // Process the file tree
  await processFileTree(fileEntries, tempDir, options, result);

  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
}

/**
 * Process regular file uploads (non-ZIP)
 */
async function processRegularFiles(
  files: Express.Multer.File[],
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  const fileEntries: FileEntry[] = files
    .filter(f => isContentFile(f.originalname))
    .map(f => ({
      relativePath: f.originalname,
      absolutePath: f.path,
      isDirectory: false
    }));

  // Process attachment files
  const attachmentFiles = files.filter(f => isAttachment(f.originalname));
  const attachmentMap = new Map<string, string>();

  for (const file of attachmentFiles) {
    const newUrl = await copyAttachmentToUploads(file.path, file.originalname);
    attachmentMap.set(file.originalname, newUrl);
    result.imported.attachments++;
  }

  // Process content files
  for (const entry of fileEntries) {
    try {
      const content = fs.readFileSync(entry.absolutePath, 'utf-8');
      const processedContent = await processContent(content, entry.relativePath, attachmentMap);
      const { title, emoji } = extractTitle(processedContent, entry.relativePath);

      const noteId = createNote(options.userId, options.parentId || null, title, emoji, processedContent);
      result.rootNoteIds.push(noteId);
      result.imported.notes++;
    } catch (error: any) {
      result.errors.push({ file: entry.relativePath, error: error.message });
    }
  }
}

/**
 * Walk through a directory recursively and build file entries
 */
async function walkDirectory(
  dir: string,
  baseDir: string,
  entries: FileEntry[]
): Promise<void> {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (item.isDirectory()) {
      entries.push({ relativePath, absolutePath: fullPath, isDirectory: true });
      await walkDirectory(fullPath, baseDir, entries);
    } else {
      entries.push({ relativePath, absolutePath: fullPath, isDirectory: false });
    }
  }
}

/**
 * Process the file tree and create notes with hierarchy
 */
async function processFileTree(
  entries: FileEntry[],
  baseDir: string,
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  // First, collect all attachments and create a mapping
  const attachmentMap = new Map<string, string>();
  const attachmentEntries = entries.filter(e => !e.isDirectory && isAttachment(e.relativePath));

  for (const entry of attachmentEntries) {
    try {
      const newUrl = await copyAttachmentToUploads(entry.absolutePath, path.basename(entry.relativePath));
      attachmentMap.set(entry.relativePath, newUrl);
      // Also map just the filename for simpler references
      attachmentMap.set(path.basename(entry.relativePath), newUrl);
      result.imported.attachments++;
    } catch (error: any) {
      result.errors.push({ file: entry.relativePath, error: error.message });
    }
  }

  // Build the hierarchical note structure
  const contentEntries = entries.filter(e => !e.isDirectory && isContentFile(e.relativePath));
  const dirEntries = entries.filter(e => e.isDirectory);

  if (options.preserveStructure) {
    // Build tree structure
    const tree = buildNoteTree(contentEntries, dirEntries, attachmentMap, baseDir);

    // Create notes from tree
    for (const noteData of tree) {
      const noteId = await createNoteFromTree(noteData, options.userId, options.parentId || null, result);
      if (noteId) {
        result.rootNoteIds.push(noteId);
      }
    }
  } else {
    // Flat import - all notes at same level
    for (const entry of contentEntries) {
      try {
        const content = fs.readFileSync(entry.absolutePath, 'utf-8');
        const processedContent = await processContent(content, entry.relativePath, attachmentMap);
        const { title, emoji } = extractTitle(processedContent, entry.relativePath);

        const noteId = createNote(options.userId, options.parentId || null, title, emoji, processedContent);
        result.rootNoteIds.push(noteId);
        result.imported.notes++;
      } catch (error: any) {
        result.errors.push({ file: entry.relativePath, error: error.message });
      }
    }
  }
}

/**
 * Build a hierarchical tree of notes from file entries
 */
function buildNoteTree(
  contentEntries: FileEntry[],
  dirEntries: FileEntry[],
  attachmentMap: Map<string, string>,
  baseDir: string
): NoteData[] {
  const tree: NoteData[] = [];
  const pathToNote = new Map<string, NoteData>();

  // Sort entries by path depth to process parents first
  const sortedDirs = [...dirEntries].sort((a, b) =>
    a.relativePath.split('/').length - b.relativePath.split('/').length
  );

  // Create placeholder notes for directories
  for (const dir of sortedDirs) {
    const parts = dir.relativePath.split('/');
    const dirName = parts[parts.length - 1];

    const noteData: NoteData = {
      title: dirName,
      titleEmoji: null,
      content: '',
      relativePath: dir.relativePath,
      children: []
    };

    pathToNote.set(dir.relativePath, noteData);

    // Find parent
    const parentPath = parts.slice(0, -1).join('/');
    if (parentPath && pathToNote.has(parentPath)) {
      pathToNote.get(parentPath)!.children.push(noteData);
    } else if (!parentPath) {
      tree.push(noteData);
    }
  }

  // Process content files
  for (const entry of contentEntries) {
    try {
      const content = fs.readFileSync(entry.absolutePath, 'utf-8');
      const processedContent = processContentSync(content, entry.relativePath, attachmentMap);
      const { title, emoji } = extractTitle(processedContent, entry.relativePath);

      const parts = entry.relativePath.split('/');
      const fileName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      // Check if this is an index file for a directory
      const isIndex = fileName.toLowerCase() === 'index.md' || fileName.toLowerCase() === 'index.html';

      if (isIndex && parentPath && pathToNote.has(parentPath)) {
        // Merge content into parent directory note
        const parentNote = pathToNote.get(parentPath)!;
        parentNote.content = processedContent;
        if (title !== 'Untitled') {
          parentNote.title = title;
        }
        parentNote.titleEmoji = emoji;
      } else {
        // Create as separate note
        const noteData: NoteData = {
          title,
          titleEmoji: emoji,
          content: processedContent,
          relativePath: entry.relativePath,
          children: []
        };

        if (parentPath && pathToNote.has(parentPath)) {
          pathToNote.get(parentPath)!.children.push(noteData);
        } else if (!parentPath) {
          tree.push(noteData);
        } else {
          // Parent directory doesn't exist, add to root
          tree.push(noteData);
        }

        pathToNote.set(entry.relativePath, noteData);
      }
    } catch (error) {
      console.error(`Error processing ${entry.relativePath}:`, error);
    }
  }

  // Filter out empty directory notes (no content and no children)
  return filterEmptyNotes(tree);
}

/**
 * Filter out notes that have no content and no children
 */
function filterEmptyNotes(notes: NoteData[]): NoteData[] {
  return notes
    .map(note => ({
      ...note,
      children: filterEmptyNotes(note.children)
    }))
    .filter(note => note.content.trim() !== '' || note.children.length > 0);
}

/**
 * Recursively create notes from a tree structure
 */
async function createNoteFromTree(
  noteData: NoteData,
  userId: number,
  parentId: number | null,
  result: ImportResult
): Promise<number | null> {
  try {
    const noteId = createNote(userId, parentId, noteData.title, noteData.titleEmoji, noteData.content);
    result.imported.notes++;

    // Create children
    for (const child of noteData.children) {
      await createNoteFromTree(child, userId, noteId, result);
    }

    return noteId;
  } catch (error: any) {
    result.errors.push({ file: noteData.relativePath, error: error.message });
    return null;
  }
}

/**
 * Process content: convert Markdown to HTML if needed, rewrite attachment URLs
 */
async function processContent(
  content: string,
  filePath: string,
  attachmentMap: Map<string, string>
): Promise<string> {
  return processContentSync(content, filePath, attachmentMap);
}

function processContentSync(
  content: string,
  filePath: string,
  attachmentMap: Map<string, string>
): string {
  const isMarkdown = filePath.endsWith('.md');
  let html = isMarkdown ? marked(content) as string : content;

  // Rewrite attachment URLs
  html = rewriteAttachmentUrls(html, attachmentMap, filePath);

  return html;
}

/**
 * Rewrite local file references to uploaded file URLs
 */
function rewriteAttachmentUrls(
  html: string,
  attachmentMap: Map<string, string>,
  filePath: string
): string {
  // Match src="..." and href="..." attributes with local paths
  const patterns = [
    /src=["']([^"']+)["']/g,
    /href=["']([^"']+)["']/g,
    /!\[([^\]]*)\]\(([^)]+)\)/g, // Markdown images that might still be in content
  ];

  let result = html;

  // Process src and href attributes
  for (const pattern of patterns.slice(0, 2)) {
    result = result.replace(pattern, (match, url) => {
      // Skip external URLs
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) {
        return match;
      }

      // Try to find the attachment
      const resolvedUrl = resolveAttachmentUrl(url, filePath, attachmentMap);
      if (resolvedUrl) {
        return match.replace(url, resolvedUrl);
      }

      return match;
    });
  }

  // Process any remaining markdown image syntax
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) {
      return match;
    }

    const resolvedUrl = resolveAttachmentUrl(url, filePath, attachmentMap);
    if (resolvedUrl) {
      return `<img src="${resolvedUrl}" alt="${alt}" />`;
    }

    return match;
  });

  return result;
}

/**
 * Resolve an attachment URL relative to the file path
 */
function resolveAttachmentUrl(
  url: string,
  filePath: string,
  attachmentMap: Map<string, string>
): string | null {
  // Normalize the URL
  const normalizedUrl = url.replace(/^\.\//, '');

  // Try direct match
  if (attachmentMap.has(normalizedUrl)) {
    return attachmentMap.get(normalizedUrl)!;
  }

  // Try just the filename
  const filename = path.basename(normalizedUrl);
  if (attachmentMap.has(filename)) {
    return attachmentMap.get(filename)!;
  }

  // Try resolving relative to the file's directory
  const fileDir = path.dirname(filePath);
  const relativePath = path.join(fileDir, normalizedUrl).replace(/\\/g, '/');
  if (attachmentMap.has(relativePath)) {
    return attachmentMap.get(relativePath)!;
  }

  // Try common attachment directories
  const commonDirs = ['attachments', 'assets', 'images', 'files', 'media'];
  for (const dir of commonDirs) {
    const tryPath = `${dir}/${filename}`;
    if (attachmentMap.has(tryPath)) {
      return attachmentMap.get(tryPath)!;
    }
  }

  return null;
}

/**
 * Copy an attachment file to the uploads directory
 */
async function copyAttachmentToUploads(sourcePath: string, originalName: string): Promise<string> {
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Generate unique filename
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(originalName);
  const newFilename = `${uniqueId}${ext}`;
  const destPath = path.join(uploadsDir, newFilename);

  // Copy file
  fs.copyFileSync(sourcePath, destPath);

  return `/uploads/${newFilename}`;
}

/**
 * Extract title and emoji from content
 */
function extractTitle(content: string, filePath: string): { title: string; emoji: string | null } {
  let title = 'Untitled';
  let emoji: string | null = null;

  // Try to find first h1 heading
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    title = h1Match[1].trim();
  } else {
    // Try markdown heading
    const mdMatch = content.match(/^#\s+(.+)$/m);
    if (mdMatch) {
      title = mdMatch[1].trim();
    } else {
      // Fall back to filename
      const basename = path.basename(filePath);
      title = basename.replace(/\.(md|html)$/i, '').replace(/[-_]/g, ' ');
    }
  }

  // Check for emoji prefix (first character)
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
  const emojiMatch = title.match(emojiRegex);
  if (emojiMatch) {
    emoji = emojiMatch[0];
    title = title.slice(emoji.length).trim();
  }

  return { title: title || 'Untitled', emoji };
}

/**
 * Check if a file is a content file (Markdown or HTML)
 */
function isContentFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.html' || ext === '.htm';
}

/**
 * Check if a file is an attachment (image, video, etc.)
 */
function isAttachment(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const attachmentExts = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
    '.mp4', '.webm', '.ogg', '.mov',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar',
    '.mp3', '.wav', '.ogg', '.flac'
  ];
  return attachmentExts.includes(ext);
}

/**
 * Create a note in the database
 */
function createNote(
  userId: number,
  parentId: number | null,
  title: string,
  titleEmoji: string | null,
  content: string
): number {
  // Get max sort order for siblings
  const maxOrder = db.prepare(`
    SELECT COALESCE(MAX(sort_order), -1) as max_order
    FROM notes WHERE user_id = ? AND parent_id IS ?
  `).get(userId, parentId) as { max_order: number };

  const sortOrder = maxOrder.max_order + 1;

  const stmt = db.prepare(`
    INSERT INTO notes (user_id, parent_id, title, title_emoji, content, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(userId, parentId, title, titleEmoji, content, sortOrder);

  return result.lastInsertRowid as number;
}
