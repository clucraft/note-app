import { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useTheme } from '../../hooks/useTheme';
import { registerSlashCommands } from './SlashCommands';
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
          lineNumbers: 'off',
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
    </div>
  );
}
