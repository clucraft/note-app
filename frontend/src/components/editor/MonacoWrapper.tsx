import { useRef, useCallback, useState, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useTheme } from '../../hooks/useTheme';
import { registerSlashCommands, EMOJI_COMMAND_PLACEHOLDER } from './SlashCommands';
import { EmojiPicker } from '../common/EmojiPicker';
import styles from './MonacoWrapper.module.css';

interface MonacoWrapperProps {
  value: string;
  onChange: (value: string) => void;
}

// Track if slash commands are registered
let slashCommandsRegistered = false;

export function MonacoWrapper({ value, onChange }: MonacoWrapperProps) {
  const { theme } = useTheme();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 });
  const emojiPlaceholderRange = useRef<Monaco.IRange | null>(null);

  // Watch for emoji placeholder insertion
  useEffect(() => {
    const placeholderIndex = value.indexOf(EMOJI_COMMAND_PLACEHOLDER);
    if (placeholderIndex !== -1 && editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        const position = model.getPositionAt(placeholderIndex);
        const coords = editor.getScrolledVisiblePosition(position);
        const editorDomNode = editor.getDomNode();

        if (coords && editorDomNode) {
          const editorRect = editorDomNode.getBoundingClientRect();
          setEmojiPickerPosition({
            top: editorRect.top + coords.top + 24,
            left: editorRect.left + coords.left
          });
        }

        // Store the range of the placeholder
        emojiPlaceholderRange.current = {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column + EMOJI_COMMAND_PLACEHOLDER.length
        };

        setShowEmojiPicker(true);
      }
    }
  }, [value]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (editorRef.current && emojiPlaceholderRange.current) {
      const editor = editorRef.current;

      // Replace the placeholder with the emoji
      editor.executeEdits('emoji-insert', [{
        range: emojiPlaceholderRange.current,
        text: emoji,
        forceMoveMarkers: true
      }]);

      emojiPlaceholderRange.current = null;
      editor.focus();
    }
    setShowEmojiPicker(false);
  }, []);

  const handleEmojiClose = useCallback(() => {
    // Remove the placeholder if user closes without selecting
    if (editorRef.current && emojiPlaceholderRange.current) {
      const editor = editorRef.current;
      editor.executeEdits('emoji-cancel', [{
        range: emojiPlaceholderRange.current,
        text: '',
        forceMoveMarkers: true
      }]);
      emojiPlaceholderRange.current = null;
      editor.focus();
    }
    setShowEmojiPicker(false);
  }, []);

  const getMonacoTheme = useCallback(() => {
    switch (theme) {
      case 'dark':
      case 'dracula':
      case 'solarized':
      case 'nord':
        return 'vs-dark';
      default:
        return 'vs';
    }
  }, [theme]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register slash commands only once
    if (!slashCommandsRegistered) {
      registerSlashCommands(monaco);
      slashCommandsRegistered = true;
    }

    // Focus the editor
    editor.focus();
  }, []);

  const handleChange = useCallback((newValue: string | undefined) => {
    onChange(newValue ?? '');
  }, [onChange]);

  return (
    <div className={styles.container}>
      <Editor
        height="100%"
        language="markdown"
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={getMonacoTheme()}
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          lineNumbers: 'on',
          fontSize: 14,
          fontFamily: 'var(--font-mono)',
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          folding: false,
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'hidden',
            verticalScrollbarSize: 8,
          },
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: false,
            comments: false,
            strings: false,
          },
          suggest: {
            showWords: false,
            showSnippets: true,
            snippetsPreventQuickSuggestions: false,
          },
          tabSize: 2,
        }}
        loading={
          <div className={styles.loading}>Loading editor...</div>
        }
      />

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={handleEmojiClose}
          position={emojiPickerPosition}
        />
      )}
    </div>
  );
}
