import { useMemo } from 'react';
import { marked } from 'marked';
import styles from './MarkdownPreview.module.css';

interface MarkdownPreviewProps {
  content: string;
}

// Configure marked once
marked.setOptions({
  breaks: true,
  gfm: true,
  async: false
});

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    return marked.parse(content) as string;
  }, [content]);

  if (!content) {
    return (
      <div className={styles.empty}>
        <p>Nothing to preview</p>
        <p className={styles.hint}>Start writing in the editor</p>
      </div>
    );
  }

  return (
    <div
      className={styles.preview}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
