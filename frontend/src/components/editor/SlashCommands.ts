import type * as Monaco from 'monaco-editor';

export interface SlashCommand {
  label: string;
  insertText: string;
  documentation: string;
  category: 'emoji' | 'format' | 'structure';
}

export const slashCommands: SlashCommand[] = [
  // Emoji commands
  { label: '/smile', insertText: '😊', documentation: 'Smile emoji', category: 'emoji' },
  { label: '/heart', insertText: '❤️', documentation: 'Heart emoji', category: 'emoji' },
  { label: '/star', insertText: '⭐', documentation: 'Star emoji', category: 'emoji' },
  { label: '/check', insertText: '✅', documentation: 'Checkmark', category: 'emoji' },
  { label: '/warning', insertText: '⚠️', documentation: 'Warning', category: 'emoji' },
  { label: '/fire', insertText: '🔥', documentation: 'Fire emoji', category: 'emoji' },
  { label: '/rocket', insertText: '🚀', documentation: 'Rocket emoji', category: 'emoji' },
  { label: '/thumbsup', insertText: '👍', documentation: 'Thumbs up', category: 'emoji' },
  { label: '/idea', insertText: '💡', documentation: 'Light bulb', category: 'emoji' },
  { label: '/bug', insertText: '🐛', documentation: 'Bug emoji', category: 'emoji' },

  // Format commands
  { label: '/bold', insertText: '**${1:text}**', documentation: 'Bold text', category: 'format' },
  { label: '/italic', insertText: '*${1:text}*', documentation: 'Italic text', category: 'format' },
  { label: '/underline', insertText: '<u>${1:text}</u>', documentation: 'Underlined text', category: 'format' },
  { label: '/strike', insertText: '~~${1:text}~~', documentation: 'Strikethrough', category: 'format' },
  { label: '/h1', insertText: '# ${1:Heading 1}', documentation: 'Heading 1', category: 'format' },
  { label: '/h2', insertText: '## ${1:Heading 2}', documentation: 'Heading 2', category: 'format' },
  { label: '/h3', insertText: '### ${1:Heading 3}', documentation: 'Heading 3', category: 'format' },
  { label: '/h4', insertText: '#### ${1:Heading 4}', documentation: 'Heading 4', category: 'format' },

  // Structure commands
  { label: '/table', insertText: '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |', documentation: 'Insert table', category: 'structure' },
  { label: '/ul', insertText: '- ${1:Item 1}\n- ${2:Item 2}\n- ${3:Item 3}', documentation: 'Unordered list', category: 'structure' },
  { label: '/ol', insertText: '1. ${1:Item 1}\n2. ${2:Item 2}\n3. ${3:Item 3}', documentation: 'Ordered list', category: 'structure' },
  { label: '/checklist', insertText: '- [ ] ${1:Task 1}\n- [ ] ${2:Task 2}\n- [ ] ${3:Task 3}', documentation: 'Checklist', category: 'structure' },
  { label: '/code', insertText: '```${1:language}\n${2:code}\n```', documentation: 'Code block', category: 'structure' },
  { label: '/quote', insertText: '> ${1:quote}', documentation: 'Blockquote', category: 'structure' },
  { label: '/hr', insertText: '\n---\n', documentation: 'Horizontal rule', category: 'structure' },
  { label: '/link', insertText: '[${1:text}](${2:url})', documentation: 'Insert link', category: 'structure' },
  { label: '/image', insertText: '![${1:alt text}](${2:image url})', documentation: 'Insert image', category: 'structure' },
];

export function registerSlashCommands(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['/'],
    provideCompletionItems: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if we're after a slash
      const slashMatch = textUntilPosition.match(/\/(\w*)$/);
      if (!slashMatch) {
        return { suggestions: [] };
      }

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - slashMatch[0].length,
        endColumn: position.column,
      };

      const suggestions = slashCommands.map((cmd) => ({
        label: cmd.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: cmd.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: cmd.documentation,
        detail: cmd.category,
        range: range,
        sortText: `${cmd.category}_${cmd.label}`,
      }));

      return { suggestions };
    },
  });
}
