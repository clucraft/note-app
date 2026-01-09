import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { uploadVideo, uploadFile } from '../../api/upload.api';
import styles from './SlashCommands.module.css';

interface CommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: any; range: any }) => void;
  isEmojiPicker?: boolean;
  isVideoUpload?: boolean;
  isFileUpload?: boolean;
  isTaskCreate?: boolean;
  isYoutubeEmbed?: boolean;
}

const commands: CommandItem[] = [
  {
    title: 'Emoji',
    description: 'Search and insert emoji',
    icon: '😀',
    isEmojiPicker: true,
    command: () => {}, // Handled specially
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Create a checklist',
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Add a blockquote',
    icon: '"',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Add a code snippet',
    icon: '</>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    description: 'Add a horizontal line',
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Table',
    description: 'Insert a table',
    icon: '⊞',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Image',
    description: 'Add an image from URL',
    icon: '🖼',
    command: ({ editor, range }) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'resizableImage',
          attrs: { src: url }
        }).run();
      }
    },
  },
  {
    title: 'Video',
    description: 'Upload a video file',
    icon: '🎬',
    isVideoUpload: true,
    command: () => {}, // Handled specially
  },
  {
    title: 'File',
    description: 'Attach any file',
    icon: '📎',
    isFileUpload: true,
    command: () => {}, // Handled specially
  },
  {
    title: 'Bold',
    description: 'Make text bold',
    icon: 'B',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBold().run();
    },
  },
  {
    title: 'Italic',
    description: 'Make text italic',
    icon: 'I',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleItalic().run();
    },
  },
  {
    title: 'Underline',
    description: 'Underline text',
    icon: 'U',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleUnderline().run();
    },
  },
  {
    title: 'Strikethrough',
    description: 'Cross out text',
    icon: 'S',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleStrike().run();
    },
  },
  {
    title: 'Date',
    description: 'Insert current date',
    icon: '📅',
    command: ({ editor, range }) => {
      const date = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      editor.chain().focus().deleteRange(range).insertContent(date).run();
    },
  },
  {
    title: 'Time',
    description: 'Insert current time',
    icon: '🕐',
    command: ({ editor, range }) => {
      const time = new Date().toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
      editor.chain().focus().deleteRange(range).insertContent(time).run();
    },
  },
  {
    title: 'Task',
    description: 'Create a scheduled task with reminder',
    icon: '📋',
    isTaskCreate: true,
    command: () => {}, // Handled specially
  },
  {
    title: 'YouTube',
    description: 'Embed a YouTube video',
    icon: '▶️',
    isYoutubeEmbed: true,
    command: () => {}, // Handled specially
  },
  {
    title: 'Mermaid',
    description: 'Insert a diagram (flowchart, sequence, etc.)',
    icon: '📊',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setMermaid().run();
    },
  },
  {
    title: 'Math Block',
    description: 'Insert a block equation (LaTeX)',
    icon: '∑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setMathBlock().run();
    },
  },
  {
    title: 'Math Inline',
    description: 'Insert inline math (LaTeX)',
    icon: 'π',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setMathInline().run();
    },
  },
];

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: any;
  range: any;
  onTaskCreate?: (editor: any, range: any) => void;
}

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command, editor, range, onTaskCreate }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleVideoUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadVideo(file);
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'video',
        attrs: { src: result.url }
      }).run();
    } catch (error) {
      console.error('Video upload failed:', error);
      alert('Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [editor, range]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadFile(file);
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'fileAttachment',
        attrs: {
          src: result.url,
          filename: result.originalName,
          size: result.size,
          mimeType: result.mimeType
        }
      }).run();
    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [editor, range]);

  const triggerFileInput = useCallback((accept: string, handler: (file: File) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handler(file);
      }
    };
    input.click();
  }, []);

  const handleYoutubeEmbed = useCallback(() => {
    const url = window.prompt('Enter YouTube URL:');
    if (!url) return;

    // Extract video ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    let videoId: string | null = null;
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      alert('Invalid YouTube URL. Please enter a valid YouTube video URL.');
      return;
    }

    editor.chain().focus().deleteRange(range).setYoutubeVideo({ url }).run();
  }, [editor, range]);

  const selectItem = useCallback((index: number) => {
    const item = items[index];
    if (item) {
      if (item.isEmojiPicker) {
        setShowEmojiPicker(true);
      } else if (item.isVideoUpload) {
        triggerFileInput('video/mp4,video/webm,video/ogg,video/quicktime', handleVideoUpload);
      } else if (item.isFileUpload) {
        triggerFileInput('*/*', handleFileUpload);
      } else if (item.isTaskCreate && onTaskCreate) {
        onTaskCreate(editor, range);
      } else if (item.isYoutubeEmbed) {
        handleYoutubeEmbed();
      } else {
        command(item);
      }
    }
  }, [items, command, triggerFileInput, handleVideoUpload, handleFileUpload, onTaskCreate, handleYoutubeEmbed, editor, range]);

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    editor.chain().focus().deleteRange(range).insertContent(emoji.native).run();
    setShowEmojiPicker(false);
  }, [editor, range]);

  useEffect(() => {
    setSelectedIndex(0);
    setShowEmojiPicker(false);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (showEmojiPicker) {
        if (event.key === 'Escape') {
          setShowEmojiPicker(false);
          return true;
        }
        return false;
      }

      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }), [items.length, selectedIndex, selectItem, showEmojiPicker]);

  if (showEmojiPicker) {
    return (
      <div className={styles.emojiPickerWrapper}>
        <Picker
          data={data}
          onEmojiSelect={handleEmojiSelect}
          theme="auto"
          previewPosition="none"
          skinTonePosition="none"
          autoFocus={true}
        />
      </div>
    );
  }

  if (isUploading) {
    return (
      <div className={styles.commandList}>
        <div className={styles.uploading}>Uploading...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className={styles.noResults}>No results</div>;
  }

  return (
    <div className={styles.commandList}>
      {items.map((item, index) => (
        <button
          key={item.title}
          className={`${styles.commandItem} ${index === selectedIndex ? styles.selected : ''}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className={styles.commandIcon}>{item.icon}</span>
          <div className={styles.commandContent}>
            <span className={styles.commandTitle}>{item.title}</span>
            <span className={styles.commandDescription}>{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
});

CommandList.displayName = 'CommandList';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: any; props: CommandItem }) => {
          props.command({ editor, range });
        },
      },
      onTaskCreate: undefined as ((editor: any, range: any) => void) | undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return commands.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance[] | null = null;
          const onTaskCreate = this.options.onTaskCreate;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(CommandList, {
                props: {
                  ...props,
                  editor: props.editor,
                  range: props.range,
                  onTaskCreate,
                },
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props: any) {
              component?.updateProps({
                ...props,
                editor: props.editor,
                range: props.range,
                onTaskCreate,
              });

              if (!props.clientRect) {
                return;
              }

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }

              return (component?.ref as CommandListRef)?.onKeyDown(props) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
