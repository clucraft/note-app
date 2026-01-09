import { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import styles from './DragHandle.module.css';

interface DragHandleProps {
  editor: Editor;
}

interface BlockInfo {
  node: HTMLElement;
  pos: number;
  rect: DOMRect;
}

export function DragHandle({ editor }: DragHandleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [handlePosition, setHandlePosition] = useState({ top: 0, left: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{ top: number; visible: boolean }>({ top: 0, visible: false });

  const handleRef = useRef<HTMLDivElement>(null);
  const currentBlockRef = useRef<BlockInfo | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const editorContainerRef = useRef<HTMLElement | null>(null);
  const isHoveringHandleRef = useRef(false);

  // Get the editor's DOM element
  const getEditorElement = useCallback(() => {
    return editor.view.dom as HTMLElement;
  }, [editor]);

  // Find the block element at a given Y position
  const findBlockAtPosition = useCallback((y: number): BlockInfo | null => {
    const editorElement = getEditorElement();
    if (!editorElement) return null;

    // Get all top-level block elements in the editor
    const blocks: BlockInfo[] = [];

    editor.state.doc.forEach((_node, pos) => {
      try {
        const domNode = editor.view.nodeDOM(pos);
        if (domNode && domNode instanceof HTMLElement) {
          const rect = domNode.getBoundingClientRect();
          blocks.push({ node: domNode, pos, rect });
        }
      } catch (e) {
        // Node might not have a DOM representation
      }
    });

    // Find the block that contains the Y position
    for (const block of blocks) {
      if (y >= block.rect.top && y <= block.rect.bottom) {
        return block;
      }
    }

    // If no exact match, find the closest block
    let closest: BlockInfo | null = null;
    let closestDistance = Infinity;

    for (const block of blocks) {
      const blockCenter = block.rect.top + block.rect.height / 2;
      const distance = Math.abs(y - blockCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = block;
      }
    }

    return closest;
  }, [editor, getEditorElement]);

  // Handle mouse move to show/hide drag handle
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) return;

    const editorElement = getEditorElement();
    if (!editorElement) return;

    const editorRect = editorElement.getBoundingClientRect();
    const container = editorElement.closest(`.${styles.editorWithHandle}`) || editorElement.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Calculate the gutter zone (left side of content)
    const gutterStart = containerRect.left;
    const gutterEnd = editorRect.left + 10; // Small overlap into content

    // Check if mouse is in the gutter zone
    const isInGutter = e.clientX >= gutterStart && e.clientX <= gutterEnd &&
                       e.clientY >= editorRect.top && e.clientY <= editorRect.bottom;

    if (isInGutter) {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Find the block at this Y position
      const block = findBlockAtPosition(e.clientY);

      if (block) {
        currentBlockRef.current = block;

        // Position the handle
        const handleTop = block.rect.top + (block.rect.height / 2) - 12; // Center vertically (24px handle)
        const handleLeft = editorRect.left - 32; // 32px to the left of content

        setHandlePosition({ top: handleTop, left: handleLeft });
        setIsVisible(true);
      }
    } else {
      // Don't hide if hovering over the handle itself
      if (isHoveringHandleRef.current) return;

      // Delay hiding to prevent flickering
      if (!hideTimeoutRef.current) {
        hideTimeoutRef.current = window.setTimeout(() => {
          if (!isHoveringHandleRef.current) {
            setIsVisible(false);
          }
          hideTimeoutRef.current = null;
        }, 150);
      }
    }
  }, [isDragging, getEditorElement, findBlockAtPosition]);

  // Handle mouse entering the drag handle
  const handleMouseEnterHandle = useCallback(() => {
    isHoveringHandleRef.current = true;
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Handle mouse leaving the drag handle
  const handleMouseLeaveHandle = useCallback(() => {
    isHoveringHandleRef.current = false;
    // Start hide timeout
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimeoutRef.current = null;
    }, 150);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!currentBlockRef.current) return;

    setIsDragging(true);

    const { pos } = currentBlockRef.current;
    const node = editor.state.doc.nodeAt(pos);

    if (node) {
      // Create a node selection for the block
      const selection = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(editor.state.tr.setSelection(selection));

      // Set drag data
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // Required for Firefox

      // Create a drag image
      const dragImage = currentBlockRef.current.node.cloneNode(true) as HTMLElement;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.opacity = '0.8';
      dragImage.style.maxWidth = '400px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);

      // Clean up drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    }
  }, [editor]);

  // Handle drag over to show drop indicator
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    const block = findBlockAtPosition(e.clientY);
    if (block && currentBlockRef.current) {
      // Determine if dropping above or below the block
      const blockCenter = block.rect.top + block.rect.height / 2;
      const dropAbove = e.clientY < blockCenter;

      const indicatorTop = dropAbove ? block.rect.top - 2 : block.rect.bottom - 2;
      setDropIndicator({ top: indicatorTop, visible: true });
    }
  }, [findBlockAtPosition]);

  // Handle drop
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();

    if (!currentBlockRef.current) return;

    const sourcePos = currentBlockRef.current.pos;
    const targetBlock = findBlockAtPosition(e.clientY);

    if (targetBlock && targetBlock.pos !== sourcePos) {
      const blockCenter = targetBlock.rect.top + targetBlock.rect.height / 2;
      const dropAbove = e.clientY < blockCenter;

      const sourceNode = editor.state.doc.nodeAt(sourcePos);
      if (!sourceNode) return;

      const targetPos = dropAbove ? targetBlock.pos : targetBlock.pos + editor.state.doc.nodeAt(targetBlock.pos)!.nodeSize;

      // Calculate the actual target position after deletion
      let adjustedTargetPos = targetPos;
      if (targetPos > sourcePos) {
        adjustedTargetPos = targetPos - sourceNode.nodeSize;
      }

      // Perform the move using a transaction
      const tr = editor.state.tr;

      // Delete the source node
      tr.delete(sourcePos, sourcePos + sourceNode.nodeSize);

      // Insert at the target position
      tr.insert(adjustedTargetPos, sourceNode);

      editor.view.dispatch(tr);
    }

    setIsDragging(false);
    setDropIndicator({ top: 0, visible: false });
    setIsVisible(false);
  }, [editor, findBlockAtPosition]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDropIndicator({ top: 0, visible: false });
  }, []);

  // Set up event listeners
  useEffect(() => {
    const editorElement = getEditorElement();
    if (!editorElement) return;

    // Find the container that wraps the editor
    const container = editorElement.closest(`.${styles.editorWithHandle}`) || editorElement.parentElement?.parentElement;
    if (container) {
      editorContainerRef.current = container as HTMLElement;
    }

    // Add mouse move listener to document for better tracking
    document.addEventListener('mousemove', handleMouseMove);

    // Add drag over and drop listeners to editor
    editorElement.addEventListener('dragover', handleDragOver);
    editorElement.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      editorElement.removeEventListener('dragover', handleDragOver);
      editorElement.removeEventListener('drop', handleDrop);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [getEditorElement, handleMouseMove, handleDragOver, handleDrop]);

  return (
    <>
      {/* Drag Handle */}
      <div
        ref={handleRef}
        className={`${styles.dragHandle} ${isVisible ? styles.visible : ''} ${isDragging ? styles.dragging : ''}`}
        style={{
          top: handlePosition.top,
          left: handlePosition.left,
        }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={handleMouseEnterHandle}
        onMouseLeave={handleMouseLeaveHandle}
        title="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </div>

      {/* Drop Indicator */}
      {dropIndicator.visible && (
        <div
          className={styles.dropIndicator}
          style={{ top: dropIndicator.top }}
        />
      )}
    </>
  );
}
