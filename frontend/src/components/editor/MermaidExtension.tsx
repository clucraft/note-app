import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid with default config
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

interface MermaidAttrs {
  code: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MermaidNodeView({ node, updateAttributes, selected }: any) {
  const attrs = node.attrs as MermaidAttrs;
  const { code } = attrs;
  const [isEditing, setIsEditing] = useState(!code);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Render mermaid diagram
  useEffect(() => {
    if (!code || isEditing) {
      setSvg('');
      return;
    }

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
        setError(null);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
        setError(errorMessage);
        setSvg('');
      }
    };

    renderDiagram();
  }, [code, isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
    // Allow tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        updateAttributes({ code: newValue });
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  return (
    <NodeViewWrapper className="mermaid-wrapper">
      <div
        style={{
          border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-md)',
          margin: '1rem 0',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>Mermaid Diagram</span>
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            {isEditing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {/* Content */}
        {isEditing ? (
          <div style={{ padding: '0.75rem' }}>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => updateAttributes({ code: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              placeholder={`Enter Mermaid syntax, e.g.:
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]`}
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '0.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              padding: '1rem',
              display: 'flex',
              justifyContent: 'center',
              minHeight: '100px',
            }}
          >
            {error ? (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                Error: {error}
              </div>
            ) : svg ? (
              <div
                dangerouslySetInnerHTML={{ __html: svg }}
                style={{ maxWidth: '100%', overflow: 'auto' }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Click "Edit" to add diagram code
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export interface MermaidOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (options?: { code?: string }) => ReturnType;
    };
  }
}

export const Mermaid = Node.create<MermaidOptions>({
  name: 'mermaid',
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
      code: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-mermaid': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },

  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMermaid: (options?: { code?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: { code: options?.code || '' },
        });
      },
    };
  },
});
