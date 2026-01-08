import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import styles from './VideoExtension.module.css';

interface VideoAttrs {
  src: string;
  width?: number;
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VideoNodeView({ node, updateAttributes, selected }: any) {
  const attrs = node.attrs as VideoAttrs;
  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const startSize = useRef({ width: 0, height: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const video = videoRef.current;
    if (!video) return;

    startSize.current = {
      width: video.offsetWidth,
      height: video.offsetHeight,
    };
    startPos.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      // Maintain 16:9 aspect ratio
      const aspectRatio = startSize.current.width / startSize.current.height;

      if (corner.includes('e')) {
        newWidth = Math.max(200, startSize.current.width + deltaX);
        newHeight = newWidth / aspectRatio;
      } else if (corner.includes('w')) {
        newWidth = Math.max(200, startSize.current.width - deltaX);
        newHeight = newWidth / aspectRatio;
      }

      if (corner.includes('s')) {
        newHeight = Math.max(100, startSize.current.height + deltaY);
        newWidth = newHeight * aspectRatio;
      } else if (corner.includes('n')) {
        newHeight = Math.max(100, startSize.current.height - deltaY);
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
    <NodeViewWrapper className={styles.videoWrapper}>
      <div
        className={`${styles.videoContainer} ${selected ? styles.selected : ''} ${isResizing ? styles.resizing : ''}`}
        onContextMenu={handleContextMenu}
      >
        <video
          ref={videoRef}
          src={attrs.src}
          controls
          style={{
            width: attrs.width ? `${attrs.width}px` : '100%',
            height: attrs.height ? `${attrs.height}px` : 'auto',
            maxWidth: '100%',
          }}
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
          <button onClick={handleCopyUrl}>Copy video URL</button>
          <button onClick={handleOpenInNewTab}>Open in new tab</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export interface VideoOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: 'video',
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
        tag: 'video[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['video', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { controls: true })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },

  addCommands() {
    return {
      setVideo: (options: { src: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});
