import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathAttrs {
  latex: string;
  displayMode: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MathNodeView({ node, updateAttributes, selected }: any) {
  const attrs = node.attrs as MathAttrs;
  const { latex, displayMode } = attrs;
  const [isEditing, setIsEditing] = useState(!latex);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Render LaTeX
  useEffect(() => {
    if (!latex) {
      setHtml('');
      setError(null);
      return;
    }

    try {
      const rendered = katex.renderToString(latex, {
        displayMode,
        throwOnError: true,
        strict: false,
      });
      setHtml(rendered);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid LaTeX';
      setError(errorMessage);
      setHtml('');
    }
  }, [latex, displayMode]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Inline math
  if (!displayMode) {
    return (
      <NodeViewWrapper as="span" className="math-inline-wrapper">
        {isEditing ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={latex}
            onChange={(e) => updateAttributes({ latex: e.target.value })}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            placeholder="x^2 + y^2 = z^2"
            style={{
              padding: '0.125rem 0.375rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875em',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              outline: 'none',
              minWidth: '100px',
            }}
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            style={{
              cursor: 'pointer',
              padding: '0 0.125rem',
              backgroundColor: selected ? 'var(--color-primary-light)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {error ? (
              <span style={{ color: 'var(--color-danger)', fontSize: '0.875em' }}>
                {latex || 'Click to edit'}
              </span>
            ) : html ? (
              <span dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                math
              </span>
            )}
          </span>
        )}
      </NodeViewWrapper>
    );
  }

  // Block/display math
  return (
    <NodeViewWrapper className="math-block-wrapper">
      <div
        style={{
          margin: '1rem 0',
          padding: '1rem',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border-color)'}`,
        }}
      >
        {isEditing ? (
          <div>
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={latex}
              onChange={(e) => updateAttributes({ latex: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={() => setIsEditing(false)}
              placeholder="\\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2}"
              style={{
                width: '100%',
                minHeight: '60px',
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Press Enter to save, Escape to cancel
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            style={{
              cursor: 'pointer',
              textAlign: 'center',
              minHeight: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {error ? (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                Error: {error}
              </div>
            ) : html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Click to add equation
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export interface MathBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface MathInlineOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (options?: { latex?: string }) => ReturnType;
    };
    mathInline: {
      setMathInline: (options?: { latex?: string }) => ReturnType;
    };
  }
}

// Block math node
export const MathBlock = Node.create<MathBlockOptions>({
  name: 'mathBlock',
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
      latex: {
        default: '',
      },
      displayMode: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-math-block': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },

  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMathBlock: (options?: { latex?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: { latex: options?.latex || '', displayMode: true },
        });
      },
    };
  },
});

// Inline math node
export const MathInline = Node.create<MathInlineOptions>({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
      },
      displayMode: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-inline]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-math-inline': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },

  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMathInline: (options?: { latex?: string }) => ({ commands }: any) => {
        return commands.insertContent({
          type: this.name,
          attrs: { latex: options?.latex || '', displayMode: false },
        });
      },
    };
  },
});
