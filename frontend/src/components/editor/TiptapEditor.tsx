import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useCallback, useState } from 'react';
import { SlashCommands } from './SlashCommandsExtension';
import { ResizableImage } from './ImageExtension';
import { expandText } from '../../api/ai.api';
import styles from './TiptapEditor.module.css';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onReady?: () => void;
}

export function TiptapEditor({ content, onChange, onReady }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: styles.link,
        },
      }),
      ResizableImage.configure({
        HTMLAttributes: {
          class: styles.image,
        },
      }),
      Placeholder.configure({
        placeholder: 'Write anything. Enter / for commands',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      SlashCommands,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onCreate: () => {
      onReady?.();
    },
    editorProps: {
      attributes: {
        class: styles.editor,
      },
    },
  });

  // Update content when prop changes (e.g., when switching notes) and focus
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      // Focus editor after content is set
      setTimeout(() => {
        // If content is just the initial H1 + empty paragraph, focus at start of paragraph (line 2)
        if (content === '<h1>Untitled</h1><p></p>') {
          // Position cursor at the start of the second node (the paragraph)
          const doc = editor.state.doc;
          if (doc.childCount >= 2) {
            const secondNodePos = doc.child(0).nodeSize;
            editor.commands.setTextSelection(secondNodePos + 1);
            editor.commands.focus();
          }
        } else {
          editor.commands.focus('end');
        }
      }, 0);
    }
  }, [content, editor]);

  const [isExpanding, setIsExpanding] = useState(false);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleExpand = useCallback(async () => {
    if (!editor || isExpanding) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (!selectedText.trim()) return;

    setIsExpanding(true);

    try {
      // Get some surrounding context
      const fullText = editor.state.doc.textContent;
      const contextStart = Math.max(0, from - 200);
      const contextEnd = Math.min(fullText.length, to + 200);
      const context = fullText.slice(contextStart, contextEnd);

      const expanded = await expandText(selectedText, context);

      // Move to end of selection, add blank line, then insert code block with AI response
      const codeContent = `AI Generated:\n${expanded}`;
      editor
        .chain()
        .focus()
        .setTextSelection(to)
        .insertContent([
          { type: 'paragraph' },
          { type: 'paragraph' },
          { type: 'codeBlock', content: [{ type: 'text', text: codeContent }] },
        ])
        .run();
    } catch (error: any) {
      console.error('Expand error:', error);
      alert(error.response?.data?.error || 'Failed to expand text. Please configure AI in Settings.');
    } finally {
      setIsExpanding(false);
    }
  }, [editor, isExpanding]);

  if (!editor) {
    return <div className={styles.loading}>Loading editor...</div>;
  }

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Focus editor when clicking in empty space
    const target = e.target as HTMLElement;
    const editorElement = target.closest('.ProseMirror');

    if (!editorElement) {
      // Clicked outside the ProseMirror editor area, focus at end
      editor?.chain().focus('end').run();
    } else if (!editor?.isFocused) {
      // Clicked inside but editor not focused, let it focus naturally
      editor?.chain().focus().run();
    }
  }, [editor]);

  return (
    <div className={styles.container} onClick={handleContainerClick}>
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className={styles.bubbleMenu}>
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive('bold') ? styles.active : ''}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? styles.active : ''}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={editor.isActive('underline') ? styles.active : ''}
              title="Underline"
            >
              U
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={editor.isActive('strike') ? styles.active : ''}
              title="Strikethrough"
            >
              S
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={editor.isActive('code') ? styles.active : ''}
              title="Code"
            >
              {'</>'}
            </button>
            <button
              onClick={setLink}
              className={editor.isActive('link') ? styles.active : ''}
              title="Link"
            >
              🔗
            </button>
            <span className={styles.bubbleDivider} />
            <button
              onClick={handleExpand}
              className={isExpanding ? styles.expanding : ''}
              disabled={isExpanding}
              title="Expand with AI"
            >
              {isExpanding ? '...' : '✨'}
            </button>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
