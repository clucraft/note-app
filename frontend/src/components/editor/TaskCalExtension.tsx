import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useCallback } from 'react';
import { completeTask } from '../../api/tasks.api';
import styles from './TaskCalExtension.module.css';

interface TaskCalAttrs {
  taskId: string;
  description: string;
  dueDate: string;
  dueTime: string;
  completed: boolean;
  snoozed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TaskCalNodeView({ node, updateAttributes }: any) {
  const attrs = node.attrs as TaskCalAttrs;

  const handleToggleComplete = useCallback(async () => {
    const newCompleted = !attrs.completed;

    // Optimistically update the UI
    updateAttributes({ completed: newCompleted });

    try {
      await completeTask(attrs.taskId, newCompleted);
    } catch (error) {
      // Revert on error
      console.error('Failed to update task:', error);
      updateAttributes({ completed: !newCompleted });
    }
  }, [attrs.taskId, attrs.completed, updateAttributes]);

  const formatDateTime = (date: string, time: string) => {
    const d = new Date(`${date}T${time}`);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <NodeViewWrapper className={styles.taskWrapper}>
      <div className={`${styles.task} ${attrs.completed ? styles.completed : ''}`}>
        <button
          className={styles.checkbox}
          onClick={handleToggleComplete}
          contentEditable={false}
        >
          {attrs.completed ? '☑' : '☐'}
        </button>
        <span className={styles.description}>{attrs.description}</span>
        <span className={styles.dateTime}>
          {attrs.snoozed && <span className={styles.snoozeIcon} title="Snoozed">💤</span>}
          {formatDateTime(attrs.dueDate, attrs.dueTime)}
        </span>
      </div>
    </NodeViewWrapper>
  );
}

export interface TaskCalOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskCal: {
      setTaskCal: (options: {
        taskId: string;
        description: string;
        dueDate: string;
        dueTime: string;
        completed?: boolean;
        snoozed?: boolean;
      }) => ReturnType;
    };
  }
}

export const TaskCal = Node.create<TaskCalOptions>({
  name: 'taskCal',
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
      taskId: {
        default: '',
      },
      description: {
        default: '',
      },
      dueDate: {
        default: '',
      },
      dueTime: {
        default: '',
      },
      completed: {
        default: false,
      },
      snoozed: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-task-cal]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-task-cal': '' }),
      `Task: ${HTMLAttributes.description}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskCalNodeView);
  },

  addCommands() {
    return {
      setTaskCal: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});
