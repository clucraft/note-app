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
    result += `${indent}- [${node.id}] ${emoji}${node.title}${fav}\n`;
    if (node.children && node.children.length > 0) {
      result += flattenTree(node.children, depth + 1);
    }
  }
  return result;
}

export function createMcpServer(apiClient: ApiClient): McpServer {
  const server = new McpServer({
    name: 'cache-notes',
    version: '1.0.0',
  });

  // Tool: list_notes
  server.tool(
    'list_notes',
    'List all notes as a tree structure. Returns note IDs, titles, and hierarchy.',
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
            text: `Note created successfully.\nID: ${note.id}\nTitle: ${note.title}`,
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
    'Update an existing note\'s title or content.',
    {
      id: z.number().describe('The note ID to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content (HTML or plain text)'),
    },
    async ({ id, title, content }) => {
      try {
        const note = await apiClient.updateNote(id, { title, content });
        return {
          content: [{
            type: 'text',
            text: `Note updated successfully.\nID: ${note.id}\nTitle: ${note.title}`,
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
