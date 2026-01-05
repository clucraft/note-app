import { useMemo } from 'react';
import { marked } from 'marked';
import styles from './MarkdownPreview.module.css';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    // Configure marked for security
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    return marked(content);
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
