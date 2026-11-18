import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient } from './api-client.js';

/**
 * Flatten a note tree into a readable text list with indentation.
 */
function flattenTree(nodes: any[], depth = 0): string {
  let result = '';
  for (const node of nodes) {
    const indent = '  '.repeat(depth);
    const emoji = node.titleEmoji ? `${node.titleEmoji} ` : '';
    const fav = node.isFavorite ? ' *' : '';
    const updated = node.updatedAt ? ` (updated: ${node.updatedAt})` : '';
    result += `${indent}- [${node.id}] ${emoji}${node.title}${fav}${updated}\n`;
    if (node.children && node.children.length > 0) {
      result += flattenTree(node.children, depth + 1);
    }
  }
  return result;
}

/**
 * Notes are stored as HTML. Content that already contains markup is passed
 * through; plain text is escaped and split into paragraphs so line breaks
 * survive instead of collapsing into a single run of text.
 */
function toHtmlFragment(content: string): string {
  if (/<[a-z][^>]*>/i.test(content)) {
    return content;
  }
  return content
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const escaped = block
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<p>${escaped.replace(/\r?\n/g, '<br>')}</p>`;
    })
    .join('');
}

export function createMcpServer(apiClient: ApiClient): McpServer {
  const server = new McpServer({
    name: 'cache-notes',
    version: '1.0.0',
  });

  // Tool: list_notes
  server.tool(
    'list_notes',
    'List all notes as a tree structure. Returns note IDs, titles, hierarchy, and last-updated timestamps.',
    {},
    async () => {
      try {
        const tree = await apiClient.listNotes();
        const text = flattenTree(tree);
        return {
          content: [{ type: 'text', text: text || 'No notes found.' }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_note
  server.tool(
    'get_note',
    'Get a note by its ID. Returns the title and full content.',
    { id: z.number().describe('The note ID') },
    async ({ id }) => {
      try {
        const note = await apiClient.getNote(id);
        const text = `# ${note.title}\n\n${note.content || '(empty)'}\n\n---\nID: ${note.id} | Created: ${note.createdAt} | Updated: ${note.updatedAt}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: search_notes
  server.tool(
    'search_notes',
    'Search notes by a query string. Returns matching notes with previews.',
    { query: z.string().describe('Search query') },
    async ({ query }) => {
      try {
        const results = await apiClient.searchNotes(query);
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: 'No results found.' }],
          };
        }
        const text = results
          .map((r: any) => `[${r.id}] ${r.title}\n   ${r.preview}`)
          .join('\n\n');
        return {
          content: [{ type: 'text', text }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_note
  server.tool(
    'create_note',
    'Create a new note with a title and optional content and parent note ID.',
    {
      title: z.string().describe('Note title'),
      content: z.string().optional().describe('Note content (HTML or plain text)'),
      parentId: z.number().nullable().optional().describe('Parent note ID for nesting'),
    },
    async ({ title, content, parentId }) => {
      try {
        const note = await apiClient.createNote({ title, content, parentId });
        return {
          content: [{
            type: 'text',
            text: `Note created successfully.\nID: ${note.id}\nTitle: ${note.title}\nCreated: ${note.createdAt}\nUpdated: ${note.updatedAt}`,
          }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_note
  server.tool(
    'update_note',
    'Update an existing note\'s title or content. Content REPLACES the note\'s entire existing content — to add to a note without overwriting it, use append_to_note instead.',
    {
      id: z.number().describe('The note ID to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content (HTML or plain text). Replaces all existing content.'),
    },
    async ({ id, title, content }) => {
      try {
        const note = await apiClient.updateNote(id, { title, content });
        return {
          content: [{
            type: 'text',
            text: `Note updated successfully.\nID: ${note.id}\nTitle: ${note.title}\nUpdated: ${note.updatedAt}`,
          }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: append_to_note
  server.tool(
    'append_to_note',
    'Append content to the end of an existing note, keeping everything already in it. Use this to add an update, log entry, or new section without resending the whole note.',
    {
      id: z.number().describe('The note ID to append to'),
      content: z.string().describe('Content to add at the end of the note (HTML preferred; plain text is converted to paragraphs)'),
    },
    async ({ id, content }) => {
      try {
        const addition = toHtmlFragment(content);
        if (!addition) {
          return {
            content: [{ type: 'text', text: 'Error: content to append is empty.' }],
            isError: true,
          };
        }
        const existing = await apiClient.getNote(id);
        const note = await apiClient.updateNote(id, {
          content: (existing.content || '') + addition,
        });
        return {
          content: [{
            type: 'text',
            text: `Content appended successfully.\nID: ${note.id}\nTitle: ${note.title}\nUpdated: ${note.updatedAt}`,
          }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_task
  server.tool(
    'create_task',
    'Create a task/reminder. Optionally link it to a note.',
    {
      description: z.string().describe('Task description'),
      dueDate: z.string().describe('Due date in YYYY-MM-DD format'),
      dueTime: z.string().optional().describe('Due time in HH:MM format (defaults to 09:00)'),
      noteId: z.number().nullable().optional().describe('Note ID to link this task to'),
    },
    async ({ description, dueDate, dueTime, noteId }) => {
      try {
        const task = await apiClient.createTask({
          description,
          dueDate,
          dueTime: dueTime || '09:00',
          noteId,
        });
        return {
          content: [{
            type: 'text',
            text: `Task created successfully.\nDescription: ${task.description}\nDue: ${task.dueDate} ${task.dueTime}`,
          }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
