import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

// Extract YouTube video ID from various URL formats
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface YoutubeAttrs {
  videoId: string;
  width: number | string;
  height: number | string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function YoutubeNodeView({ node }: any) {
  const attrs = node.attrs as YoutubeAttrs;
  const { videoId, width } = attrs;

  return (
    <NodeViewWrapper className="youtube-wrapper">
      <div
        style={{
          position: 'relative',
          width: width || '100%',
          maxWidth: '100%',
          aspectRatio: '16/9',
          margin: '1rem 0',
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: 'var(--radius-md)',
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}

export interface YoutubeOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtube: {
      setYoutubeVideo: (options: { url: string }) => ReturnType;
    };
  }
}

export const Youtube = Node.create<YoutubeOptions>({
  name: 'youtube',
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
      videoId: {
        default: null,
      },
      width: {
        default: '100%',
      },
      height: {
        default: 'auto',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-youtube-video': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeNodeView);
  },

  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setYoutubeVideo: (options: { url: string }) => ({ commands }: any) => {
        const videoId = extractYoutubeId(options.url);
        if (!videoId) return false;

        return commands.insertContent({
          type: this.name,
          attrs: { videoId },
        });
      },
    };
  },
});

// Helper to prompt user for YouTube URL
export function promptYoutubeUrl(): string | null {
  const url = window.prompt('Enter YouTube URL:');
  if (!url) return null;

  const videoId = extractYoutubeId(url);
  if (!videoId) {
    alert('Invalid YouTube URL. Please enter a valid YouTube video URL.');
    return null;
  }

  return url;
}
