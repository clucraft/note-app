import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect, useCallback, useState } from 'react';
import { SlashCommands } from './SlashCommandsExtension';
import { ResizableImage } from './ImageExtension';
import { Video } from './VideoExtension';
import { FileAttachment } from './FileExtension';
import { CodeBlock } from './CodeBlockExtension';
import { TaskCal } from './TaskCalExtension';
import { FindReplaceExtension } from './FindReplaceExtension';
import { FindReplace } from './FindReplace';
import { Youtube } from './YoutubeExtension';
import { Mermaid } from './MermaidExtension';
import { MathBlock, MathInline } from './MathExtension';
import { DragHandle } from './DragHandle';
import { TextColorPicker } from './TextColorPicker';
import { TaskCreateModal } from '../common/TaskCreateModal';
import { expandText } from '../../api/ai.api';
import { createTask } from '../../api/tasks.api';
import styles from './TiptapEditor.module.css';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onReady?: () => void;
  noteId?: number;
}

export function TiptapEditor({ content, onChange, onReady, noteId }: TiptapEditorProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);

  const handleTaskCreate = useCallback((editorInstance: any, range: any) => {
    // Delete the slash command text and open the modal
    editorInstance.chain().focus().deleteRange(range).run();
    setIsTaskModalOpen(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
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
      CodeBlock,
      Video,
      FileAttachment,
      TaskCal,
      Youtube,
      Mermaid,
      MathBlock,
      MathInline,
      SlashCommands.configure({
        onTaskCreate: handleTaskCreate,
      }),
      FindReplaceExtension,
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

  // Focus editor on mount (component remounts when note changes via key prop)
  useEffect(() => {
    if (editor) {
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
          // For existing notes, focus at the start without scrolling
          editor.commands.focus('start');
        }
      }, 0);
    }
    // Only run on mount - component remounts when switching notes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Ctrl+F keyboard shortcut for find/replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleTaskConfirm = useCallback(async (data: { description: string; dueDate: string; dueTime: string }) => {
    if (!editor) return;

    try {
      // Generate a unique task ID
      const taskId = crypto.randomUUID();

      // Create task in database
      const task = await createTask({
        taskId,
        noteId,
        description: data.description,
        dueDate: data.dueDate,
        dueTime: data.dueTime,
      });

      // Insert TaskCal node at cursor position
      editor.chain().focus().setTaskCal({
        taskId: task.taskId,
        description: task.description,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        completed: false,
        snoozed: false,
      }).run();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task. Please try again.');
    }

    setIsTaskModalOpen(false);
  }, [editor, noteId]);

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
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100, interactive: true, hideOnClick: false }}>
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
            <TextColorPicker editor={editor} />
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
      <DragHandle editor={editor} />
      <TaskCreateModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onConfirm={handleTaskConfirm}
      />
      <FindReplace
        editor={editor}
        isOpen={isFindReplaceOpen}
        onClose={() => setIsFindReplaceOpen(false)}
      />
    </div>
  );
}
