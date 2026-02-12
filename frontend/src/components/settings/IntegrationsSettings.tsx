import { useState, useEffect } from 'react';
import { getApiKeys, createApiKey, deleteApiKey } from '../../api/apikeys.api';
import type { ApiKeyInfo } from '../../api/apikeys.api';
import styles from './IntegrationsSettings.module.css';

export function IntegrationsSettings() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const data = await getApiKeys();
      setKeys(data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setError('');
    setIsCreating(true);

    try {
      const result = await createApiKey(newKeyName.trim());
      setNewKeyValue(result.key);
      setNewKeyName('');
      setCopied(false);
      await loadKeys();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Revoke API key "${name}"? Any integrations using this key will stop working.`)) {
      return;
    }
    try {
      await deleteApiKey(id);
      await loadKeys();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke API key');
    }
  };

  const handleCopy = async () => {
    if (newKeyValue) {
      await navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>Integrations</h2>
      <p className={styles.subtitle}>
        Manage API keys for external integrations like the MCP server for Claude.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <h3 className={styles.label}>Create API Key</h3>
        <p className={styles.description}>
          Generate an API key for use with the MCP server or other integrations.
        </p>
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.input}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Claude MCP)"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            className={styles.generateButton}
            onClick={handleCreate}
            disabled={isCreating || !newKeyName.trim()}
          >
            {isCreating ? 'Creating...' : 'Generate'}
          </button>
        </div>

        {newKeyValue && (
          <div className={styles.newKeyBox}>
            <div className={styles.newKeyLabel}>Your new API key:</div>
            <div className={styles.newKeyValue}>
              <span className={styles.keyText}>{newKeyValue}</span>
              <button className={styles.copyButton} onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className={styles.newKeyWarning}>
              Save this key now — it won't be shown again.
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.label}>API Keys</h3>
        {keys.length === 0 ? (
          <div className={styles.emptyState}>No API keys yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Created</th>
                <th>Last Used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td className={styles.prefixCell}>{k.keyPrefix}...</td>
                  <td>{formatDate(k.createdAt)}</td>
                  <td>{formatDate(k.lastUsedAt)}</td>
                  <td>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDelete(k.id, k.name)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.info}>
        <span className={styles.infoIcon}>ℹ️</span>
        <span>
          To use with the MCP server, start it with{' '}
          <span className={styles.code}>docker compose --profile mcp up -d</span>{' '}
          then configure your MCP client with the SSE URL:{' '}
          <span className={styles.code}>http://localhost:3002/sse?apiKey=YOUR_KEY</span>
        </span>
      </div>
    </div>
  );
}
