import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile, updatePreferences } from '../../api/auth.api';
import { getTwoFAStatus, setupTwoFA, enableTwoFA, disableTwoFA, type TwoFASetup } from '../../api/twofa.api';
import { getNotesTree } from '../../api/notes.api';
import { importDocmost, type ImportResult } from '../../api/import.api';
import { exportNotes } from '../../api/export.api';
import type { Note } from '../../types/note.types';
import styles from './Profile.module.css';

const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'zh-CN', name: '中文 (简体)' },
  { code: 'hi-IN', name: 'हिन्दी' },
  { code: 'es-ES', name: 'Español' },
  { code: 'ar-SA', name: 'العربية' },
];

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Stockholm', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
  'Asia/Mumbai', 'Asia/Dubai', 'Asia/Bangkok', 'Asia/Jakarta',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland', 'Pacific/Honolulu',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
];

export function Profile() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [language, setLanguage] = useState(user?.language || 'en-US');
  const [timezone, setTimezone] = useState(user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [timezones, setTimezones] = useState<string[]>([]);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [twoFASetup, setTwoFASetup] = useState<TwoFASetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  // Import state
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importFolderInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [importParentId, setImportParentId] = useState<string>('');
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Export state
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html'>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize timezones list
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = COMMON_TIMEZONES.includes(userTz)
      ? COMMON_TIMEZONES
      : [userTz, ...COMMON_TIMEZONES];
    setTimezones(zones);

    // Load 2FA status
    loadTwoFAStatus();

    // Load notes for import destination dropdown
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const tree = await getNotesTree();
      setNotes(tree);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  const loadTwoFAStatus = async () => {
    try {
      const status = await getTwoFAStatus();
      setTwoFAEnabled(status.enabled);
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleSetupTwoFA = async () => {
    setIsSettingUp2FA(true);
    setError('');
    try {
      const setup = await setupTwoFA();
      setTwoFASetup(setup);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set up 2FA');
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const handleEnableTwoFA = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    setIsVerifying2FA(true);
    setError('');
    try {
      await enableTwoFA(verificationCode);
      setTwoFAEnabled(true);
      setTwoFASetup(null);
      setVerificationCode('');
      setSuccess('2FA has been enabled successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify code');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleDisableTwoFA = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    setIsVerifying2FA(true);
    setError('');
    try {
      await disableTwoFA(verificationCode);
      setTwoFAEnabled(false);
      setVerificationCode('');
      setSuccess('2FA has been disabled.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleCancelTwoFASetup = () => {
    setTwoFASetup(null);
    setVerificationCode('');
    setError('');
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setEmail(user.email);
      setProfilePicture(user.profilePicture || null);
      setLanguage(user.language || 'en-US');
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setProfilePicture(base64);
      setError('');

      try {
        await updateProfile({ profilePicture: base64 });
        refreshUser();
        setSuccess('Profile picture updated');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to update profile picture');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = async () => {
    try {
      await updateProfile({ profilePicture: null });
      setProfilePicture(null);
      refreshUser();
      setSuccess('Profile picture removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove profile picture');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await updateProfile({
        displayName,
        email
      });
      refreshUser();
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      await updateProfile({
        currentPassword,
        newPassword
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitial = () => {
    return (user?.displayName || user?.username || 'U')[0].toUpperCase();
  };

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    try {
      await updatePreferences({ language: newLanguage });
      refreshUser();
      setSuccess('Language updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to update language:', error);
      setError('Failed to update language');
    }
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    setTimezone(newTimezone);
    try {
      await updatePreferences({ timezone: newTimezone });
      refreshUser();
      setSuccess('Timezone updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to update timezone:', error);
      setError('Failed to update timezone');
    }
  };

  // Flatten notes tree for dropdown
  const flattenNotes = (noteList: Note[], depth = 0): Array<{ id: number; title: string; depth: number }> => {
    const result: Array<{ id: number; title: string; depth: number }> = [];
    for (const note of noteList) {
      result.push({ id: note.id, title: note.title, depth });
      if (note.children && note.children.length > 0) {
        result.push(...flattenNotes(note.children, depth + 1));
      }
    }
    return result;
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    setError('');
    setSuccess('');

    try {
      const fileArray = Array.from(files);
      const result = await importDocmost(
        fileArray,
        {
          parentId: importParentId ? parseInt(importParentId, 10) : null,
          preserveStructure
        },
        (progress) => setImportProgress(progress)
      );

      setImportResult(result);

      if (result.success) {
        setSuccess(`Successfully imported ${result.imported.notes} notes and ${result.imported.attachments} attachments`);
        // Refresh notes list
        loadNotes();
      } else {
        setError(`Import completed with errors. Imported ${result.imported.notes} notes.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import files');
      setImportResult(null);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      // Reset file inputs
      if (importFileInputRef.current) importFileInputRef.current.value = '';
      if (importFolderInputRef.current) importFolderInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setError('');
    setSuccess('');

    try {
      await exportNotes(exportFormat);
      setSuccess(`Notes exported as ${exportFormat === 'markdown' ? 'Markdown' : 'HTML'}`);
    } catch (err: any) {
      setExportError(err.response?.data?.error || 'Failed to export notes');
      setError('Failed to export notes');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')}>
          &larr; Back
        </button>
        <h1 className={styles.title}>Profile</h1>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.section}>
        <h3 className={styles.label}>Profile Picture</h3>
        <div className={styles.avatarSection}>
          {profilePicture ? (
            <img src={profilePicture} alt="Profile" className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>{getInitial()}</div>
          )}
          <div className={styles.avatarButtons}>
            <button
              className={styles.uploadButton}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Photo
            </button>
            {profilePicture && (
              <button
                className={styles.removeButton}
                onClick={handleRemovePicture}
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className={styles.hiddenInput}
          />
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Account Information</h3>
        <p className={styles.description}>Update your display name and email address</p>
        <form onSubmit={handleSaveProfile} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              placeholder="Your name"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="your@email.com"
              required
            />
          </div>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Change Password</h3>
        <p className={styles.description}>Update your password to keep your account secure</p>
        <form onSubmit={handleChangePassword} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter current password"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              placeholder="Confirm new password"
              required
            />
          </div>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {isChangingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Two-Factor Authentication</h3>
        <p className={styles.description}>
          Add an extra layer of security to your account using an authenticator app.
        </p>

        {twoFALoading ? (
          <p className={styles.loadingText}>Loading 2FA status...</p>
        ) : twoFAEnabled ? (
          <div className={styles.twoFABox}>
            <div className={styles.twoFAStatus}>
              <span className={styles.statusEnabled}>Enabled</span>
              <span className={styles.statusText}>Your account is protected with 2FA</span>
            </div>
            <div className={styles.twoFADisable}>
              <p className={styles.smallText}>To disable 2FA, enter a code from your authenticator app:</p>
              <div className={styles.codeRow}>
                <input
                  type="text"
                  className={styles.codeInput}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <button
                  className={styles.dangerButton}
                  onClick={handleDisableTwoFA}
                  disabled={isVerifying2FA}
                >
                  {isVerifying2FA ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          </div>
        ) : twoFASetup ? (
          <div className={styles.twoFABox}>
            <p className={styles.stepText}>1. Scan this QR code with your authenticator app:</p>
            <div className={styles.qrWrapper}>
              <img src={twoFASetup.qrCode} alt="2FA QR Code" className={styles.qrCode} />
            </div>
            <p className={styles.manualCode}>
              Or enter manually: <code className={styles.secret}>{twoFASetup.secret}</code>
            </p>
            <p className={styles.stepText}>2. Enter the 6-digit code from your app:</p>
            <div className={styles.codeRow}>
              <input
                type="text"
                className={styles.codeInput}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button
                className={styles.saveButton}
                onClick={handleEnableTwoFA}
                disabled={isVerifying2FA}
              >
                {isVerifying2FA ? 'Verifying...' : 'Verify & Enable'}
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCancelTwoFASetup}
                disabled={isVerifying2FA}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.saveButton}
            onClick={handleSetupTwoFA}
            disabled={isSettingUp2FA}
          >
            {isSettingUp2FA ? 'Setting up...' : 'Set Up 2FA'}
          </button>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Language</h3>
        <p className={styles.description}>Select your preferred language</p>
        <select
          className={styles.select}
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Timezone</h3>
        <p className={styles.description}>
          Your detected timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
        <select
          className={styles.select}
          value={timezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Import Notes</h3>
        <p className={styles.description}>
          Import notes from Docmost exports (.md, .html, or .zip files). Attachments and folder hierarchy will be preserved.
        </p>

        <div className={styles.importOptions}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Destination</label>
            <select
              className={styles.select}
              value={importParentId}
              onChange={(e) => setImportParentId(e.target.value)}
              disabled={isImporting}
            >
              <option value="">Root level</option>
              {flattenNotes(notes).map((note) => (
                <option key={note.id} value={note.id}>
                  {'  '.repeat(note.depth)}{note.title}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preserveStructure}
                onChange={(e) => setPreserveStructure(e.target.checked)}
                disabled={isImporting}
              />
              Preserve folder structure
            </label>
          </div>

          <div className={styles.importButtons}>
            <button
              className={styles.uploadButton}
              onClick={() => importFileInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Select Files'}
            </button>
            <button
              className={styles.uploadButton}
              onClick={() => importFolderInputRef.current?.click()}
              disabled={isImporting}
            >
              Select Folder
            </button>
          </div>

          <input
            ref={importFileInputRef}
            type="file"
            accept=".md,.html,.htm,.zip,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.pdf"
            multiple
            onChange={(e) => handleImportFiles(e.target.files)}
            className={styles.hiddenInput}
          />
          <input
            ref={importFolderInputRef}
            type="file"
            // @ts-ignore - webkitdirectory is not in the type definitions
            webkitdirectory=""
            multiple
            onChange={(e) => handleImportFiles(e.target.files)}
            className={styles.hiddenInput}
          />

          {isImporting && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>{importProgress}% uploaded</span>
            </div>
          )}

          {importResult && importResult.errors.length > 0 && (
            <div className={styles.importErrors}>
              <p className={styles.importErrorTitle}>Some files had errors:</p>
              <ul className={styles.importErrorList}>
                {importResult.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err.file}: {err.error}</li>
                ))}
                {importResult.errors.length > 5 && (
                  <li>...and {importResult.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.label}>Export Notes</h3>
        <p className={styles.description}>
          Export all notes as a ZIP file with folder hierarchy and attachments preserved.
        </p>

        <div className={styles.importOptions}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Format</label>
            <select
              className={styles.select}
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'markdown' | 'html')}
              disabled={isExporting}
            >
              <option value="markdown">Markdown (.md)</option>
              <option value="html">HTML (.html)</option>
            </select>
          </div>

          <div className={styles.importButtons}>
            <button
              className={styles.uploadButton}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export All Notes'}
            </button>
          </div>

          {exportError && (
            <div className={styles.importErrors}>
              <p className={styles.importErrorTitle}>{exportError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
