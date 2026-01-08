import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useCallback } from 'react';
import styles from './FileExtension.module.css';

interface FileAttrs {
  src: string;
  filename: string;
  size: number;
  mimeType: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('application/pdf')) return '📄';
  if (mimeType.startsWith('application/msword') || mimeType.includes('wordprocessingml')) return '📝';
  if (mimeType.startsWith('application/vnd.ms-excel') || mimeType.includes('spreadsheetml')) return '📊';
  if (mimeType.startsWith('application/vnd.ms-powerpoint') || mimeType.includes('presentationml')) return '📽️';
  if (mimeType.startsWith('application/zip') || mimeType.includes('compressed')) return '🗜️';
  if (mimeType.startsWith('text/')) return '📃';
  if (mimeType.startsWith('audio/')) return '🎵';
  return '📎';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FileNodeView({ node, selected }: any) {
  const attrs = node.attrs as FileAttrs;

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = attrs.src;
    link.download = attrs.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [attrs.src, attrs.filename]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(attrs.src, '_blank');
  }, [attrs.src]);

  return (
    <NodeViewWrapper className={styles.fileWrapper}>
      <div className={`${styles.fileContainer} ${selected ? styles.selected : ''}`}>
        <span className={styles.fileIcon}>{getFileIcon(attrs.mimeType)}</span>
        <div className={styles.fileInfo}>
          <span className={styles.filename}>{attrs.filename}</span>
          <span className={styles.fileSize}>{formatFileSize(attrs.size)}</span>
        </div>
        <div className={styles.actions}>
          <button onClick={handleDownload} title="Download" className={styles.actionButton}>
            ⬇️
          </button>
          <button onClick={handleOpenInNewTab} title="Open in new tab" className={styles.actionButton}>
            🔗
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export interface FileAttachmentOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (options: { src: string; filename: string; size: number; mimeType: string }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      filename: {
        default: 'file',
      },
      size: {
        default: 0,
      },
      mimeType: {
        default: 'application/octet-stream',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-attachment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-file-attachment': '' }),
      [
        'a',
        { href: HTMLAttributes.src as string, download: HTMLAttributes.filename as string },
        HTMLAttributes.filename as string,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
  },

  addCommands() {
    return {
      setFileAttachment: (options: { src: string; filename: string; size: number; mimeType: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});
