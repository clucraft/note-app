import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';
import { toHtml } from 'hast-util-to-html';
import powershell from 'highlight.js/lib/languages/powershell';
import { useState, useCallback, useMemo } from 'react';
import styles from './CodeBlockExtension.module.css';

// Create lowlight instance with common languages
export const lowlight = createLowlight(common);

// Register additional languages not in common
lowlight.register('powershell', powershell);

// Get list of registered languages
const registeredLanguages = lowlight.listLanguages();

// Language display names mapping
const languageNames: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  scala: 'Scala',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  sql: 'SQL',
  graphql: 'GraphQL',
  bash: 'Bash',
  shell: 'Shell',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  nginx: 'Nginx',
  apache: 'Apache',
  makefile: 'Makefile',
  plaintext: 'Plain Text',
  diff: 'Diff',
  ini: 'INI',
  toml: 'TOML',
  lua: 'Lua',
  perl: 'Perl',
  r: 'R',
  matlab: 'MATLAB',
  objectivec: 'Objective-C',
  arduino: 'Arduino',
  wasm: 'WebAssembly',
};

// Sort languages alphabetically by display name
const sortedLanguages = [...registeredLanguages].sort((a, b) => {
  const nameA = languageNames[a] || a;
  const nameB = languageNames[b] || b;
  return nameA.localeCompare(nameB);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlockNodeView({ node, updateAttributes }: any) {
  const [copied, setCopied] = useState(false);
  const language = node.attrs.language || '';
  const code = node.textContent || '';

  // Generate highlighted HTML
  const highlightedCode = useMemo(() => {
    if (!code) return '';
    try {
      const result = language && registeredLanguages.includes(language)
        ? lowlight.highlight(language, code)
        : lowlight.highlightAuto(code);
      return toHtml(result);
    } catch {
      return code;
    }
  }, [code, language]);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAttributes({ language: e.target.value });
  }, [updateAttributes]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  // Prevent editor from handling events on the header controls
  const stopPropagation = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <NodeViewWrapper className={styles.codeBlockWrapper}>
      <div
        className={styles.codeBlockHeader}
        contentEditable={false}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      >
        <select
          className={styles.languageSelect}
          value={language}
          onChange={handleLanguageChange}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
          onFocus={stopPropagation}
        >
          <option value="">Auto-detect</option>
          {sortedLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {languageNames[lang] || lang}
            </option>
          ))}
        </select>
        <button
          className={styles.copyButton}
          onClick={handleCopy}
          onMouseDown={stopPropagation}
          title="Copy code"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className={styles.codeBlockPre}>
        <NodeViewContent as="code" />
      </pre>
      {/* Hidden highlighted overlay for syntax colors */}
      <pre className={styles.codeBlockHighlight} aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
}).configure({
  lowlight,
});
