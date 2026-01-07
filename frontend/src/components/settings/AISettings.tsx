import { useState, useEffect } from 'react';
import { getAISettings, updateAISettings, testAIConnection } from '../../api/ai.api';
import type { AISettings as AISettingsType, AIProvider, AISettingsInput } from '../../types/ai.types';
import { AI_MODELS, AI_PROVIDER_NAMES } from '../../types/ai.types';
import styles from './AISettings.module.css';

export function AISettings() {
  const [settings, setSettings] = useState<AISettingsType | null>(null);
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getAISettings();
      setSettings(data);
      if (data) {
        setProvider(data.provider);
        setApiKey(data.apiKey);
        setModel(data.model);
        setEndpoint(data.endpoint || '');
        if (data.provider === 'openwebui') {
          setCustomModel(data.model);
        }
      }
    } catch (err) {
      console.error('Failed to load AI settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    // Reset model when provider changes
    const models = AI_MODELS[newProvider];
    if (models.length > 0) {
      setModel(models[0]);
    } else {
      setModel(customModel || '');
    }
    // Clear endpoint for non-openwebui providers
    if (newProvider !== 'openwebui') {
      setEndpoint('');
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    // API key is required for OpenAI and Anthropic, optional for OpenWebUI/Ollama
    const needsApiKey = provider !== 'openwebui';
    if (needsApiKey && (!apiKey || (apiKey.startsWith('••••') && !settings?.hasApiKey))) {
      setError('API key is required');
      return;
    }

    const selectedModel = provider === 'openwebui' ? customModel : model;
    if (!selectedModel) {
      setError('Model is required');
      return;
    }

    if (provider === 'openwebui' && !endpoint) {
      setError('Endpoint URL is required for OpenWebUI/Ollama');
      return;
    }

    setIsSaving(true);

    try {
      const input: AISettingsInput = {
        provider,
        apiKey,
        model: selectedModel,
        endpoint: provider === 'openwebui' ? endpoint : null,
      };

      const updated = await updateAISettings(input);
      setSettings(updated);
      setApiKey(updated.apiKey);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setError('');
    setSuccess('');
    setIsTesting(true);

    try {
      const result = await testAIConnection();
      if (result.success) {
        setSuccess('Connection successful!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  const models = AI_MODELS[provider];
  const showModelDropdown = models.length > 0;

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>AI Settings</h2>
      <p className={styles.subtitle}>
        Configure AI to enhance your note-taking experience with search summaries and text expansion.
      </p>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.section}>
        <h3 className={styles.label}>Provider</h3>
        <p className={styles.description}>Select your AI provider</p>
        <select
          className={styles.select}
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
        >
          {Object.entries(AI_PROVIDER_NAMES).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <h3 className={styles.label}>
          API Key {provider === 'openwebui' && <span className={styles.optional}>(Optional)</span>}
        </h3>
        <p className={styles.description}>
          {provider === 'openwebui'
            ? 'API key for authentication (leave empty for local Ollama)'
            : `Your API key for ${AI_PROVIDER_NAMES[provider]}`}
        </p>
        <div className={styles.inputGroup}>
          <input
            type={showApiKey ? 'text' : 'password'}
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'openwebui' ? 'Optional - leave empty for Ollama' : 'Enter your API key'}
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowApiKey(!showApiKey)}
            title={showApiKey ? 'Hide' : 'Show'}
          >
            {showApiKey ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.label}>Model</h3>
        <p className={styles.description}>Select the AI model to use</p>
        {showModelDropdown ? (
          <select
            className={styles.select}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className={styles.input}
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="Enter model name (e.g., llama2, mistral)"
          />
        )}
      </div>

      {provider === 'openwebui' && (
        <div className={styles.section}>
          <h3 className={styles.label}>Endpoint URL</h3>
          <p className={styles.description}>
            API endpoint URL (Ollama default: http://localhost:11434/v1)
          </p>
          <input
            type="text"
            className={styles.input}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </div>
      )}

      <div className={styles.buttonGroup}>
        <button
          className={styles.testButton}
          onClick={handleTest}
          disabled={isTesting || !settings || (provider !== 'openwebui' && !settings.hasApiKey)}
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span>
          API keys are stored in the database. Only use this on a trusted/private server.
        </span>
      </div>
    </div>
  );
}
