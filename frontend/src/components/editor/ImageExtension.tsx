import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { useState, useCallback, useRef, useEffect } from 'react';
import { uploadImageFromBlob } from '../../api/upload.api';
import styles from './ImageExtension.module.css';

interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ImageNodeView({ node, updateAttributes, selected }: any) {
  const attrs = node.attrs as ImageAttrs;
  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const startSize = useRef({ width: 0, height: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const img = imageRef.current;
    if (!img) return;

    startSize.current = {
      width: img.offsetWidth,
      height: img.offsetHeight,
    };
    startPos.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      // Maintain aspect ratio
      const aspectRatio = startSize.current.width / startSize.current.height;

      if (corner.includes('e')) {
        newWidth = Math.max(50, startSize.current.width + deltaX);
        newHeight = newWidth / aspectRatio;
      } else if (corner.includes('w')) {
        newWidth = Math.max(50, startSize.current.width - deltaX);
        newHeight = newWidth / aspectRatio;
      }

      if (corner.includes('s')) {
        newHeight = Math.max(50, startSize.current.height + deltaY);
        newWidth = newHeight * aspectRatio;
      } else if (corner.includes('n')) {
        newHeight = Math.max(50, startSize.current.height - deltaY);
        newWidth = newHeight * aspectRatio;
      }

      updateAttributes({
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateAttributes]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleCopyImage = useCallback(async () => {
    try {
      const response = await fetch(attrs.src);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      setShowContextMenu(false);
    } catch (err) {
      console.error('Failed to copy image:', err);
      // Fallback: copy URL
      try {
        await navigator.clipboard.writeText(attrs.src);
        setShowContextMenu(false);
      } catch {
        console.error('Failed to copy image URL');
      }
    }
  }, [attrs.src]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(attrs.src);
      setShowContextMenu(false);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, [attrs.src]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(attrs.src, '_blank');
    setShowContextMenu(false);
  }, [attrs.src]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showContextMenu]);

  return (
    <NodeViewWrapper className={styles.imageWrapper}>
      <div
        className={`${styles.imageContainer} ${selected ? styles.selected : ''} ${isResizing ? styles.resizing : ''}`}
        onContextMenu={handleContextMenu}
      >
        <img
          ref={imageRef}
          src={attrs.src}
          alt={attrs.alt || ''}
          title={attrs.title || ''}
          style={{
            width: attrs.width ? `${attrs.width}px` : 'auto',
            height: attrs.height ? `${attrs.height}px` : 'auto',
          }}
          draggable={false}
        />
        {selected && (
          <>
            <div
              className={`${styles.resizeHandle} ${styles.nw}`}
              onMouseDown={(e) => handleMouseDown(e, 'nw')}
            />
            <div
              className={`${styles.resizeHandle} ${styles.ne}`}
              onMouseDown={(e) => handleMouseDown(e, 'ne')}
            />
            <div
              className={`${styles.resizeHandle} ${styles.sw}`}
              onMouseDown={(e) => handleMouseDown(e, 'sw')}
            />
            <div
              className={`${styles.resizeHandle} ${styles.se}`}
              onMouseDown={(e) => handleMouseDown(e, 'se')}
            />
          </>
        )}
      </div>
      {showContextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button onClick={handleCopyImage}>Copy image</button>
          <button onClick={handleCopyUrl}>Copy image URL</button>
          <button onClick={handleOpenInNewTab}>Open in new tab</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// Plugin to handle drop and paste of images
const imageUploadPluginKey = new PluginKey('imageUpload');

function createImageUploadPlugin(uploadFn: (file: File) => Promise<string>) {
  return new Plugin({
    key: imageUploadPluginKey,
    props: {
      handleDrop(view: EditorView, event: DragEvent) {
        const hasFiles = event.dataTransfer?.files && event.dataTransfer.files.length > 0;
        if (!hasFiles) return false;

        const files = Array.from(event.dataTransfer!.files);
        const imageFile = files.find((file: File) => file.type.startsWith('image/'));

        if (imageFile) {
          event.preventDefault();
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });

          uploadFn(imageFile).then(url => {
            const { schema } = view.state;
            const node = schema.nodes.resizableImage.create({ src: url });
            if (coordinates) {
              const transaction = view.state.tr.insert(coordinates.pos, node);
              view.dispatch(transaction);
            }
          }).catch(err => {
            console.error('Failed to upload dropped image:', err);
          });
          return true;
        }
        return false;
      },
      handlePaste(view: EditorView, event: ClipboardEvent) {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();

              uploadFn(file).then(url => {
                const { schema } = view.state;
                const node = schema.nodes.resizableImage.create({ src: url });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }).catch(err => {
                console.error('Failed to upload pasted image:', err);
              });
              return true;
            }
          }
        }
        return false;
      },
    },
  });
}

export interface ResizableImageOptions {
  HTMLAttributes: Record<string, unknown>;
  uploadImage?: (file: File) => Promise<string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

export const ResizableImage = Node.create<ResizableImageOptions>({
  name: 'resizableImage',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      uploadImage: async (file: File) => {
        const result = await uploadImageFromBlob(file, file.name);
        return result.url;
      },
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addProseMirrorPlugins() {
    return [
      createImageUploadPlugin(this.options.uploadImage!),
    ];
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; title?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});
