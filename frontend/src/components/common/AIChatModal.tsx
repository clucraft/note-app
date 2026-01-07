import { useState, useRef, useEffect, useCallback } from 'react';
import { aiChat, ChatMessage } from '../../api/ai.api';
import styles from './AIChatModal.module.css';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to chat
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await aiChat(userMessage, messages);
      setMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to get response. Please try again.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>AI Chat</h2>
          <div className={styles.headerActions}>
            {messages.length > 0 && (
              <button
                className={styles.clearButton}
                onClick={handleClearChat}
                title="Clear chat"
              >
                Clear
              </button>
            )}
            <button className={styles.closeButton} onClick={onClose} title="Close">
              &times;
            </button>
          </div>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <p>Ask me anything about your notes!</p>
              <p className={styles.hint}>I have access to all your notes and can help you find information, summarize content, or answer questions.</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
            >
              <div className={styles.messageContent}>{msg.content}</div>
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.messageContent}>
                <span className={styles.typing}>Thinking...</span>
              </div>
            </div>
          )}
          {error && (
            <div className={styles.error}>{error}</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.inputForm} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your notes..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!input.trim() || isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
