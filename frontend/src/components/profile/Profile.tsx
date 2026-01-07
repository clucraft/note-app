import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile, updatePreferences } from '../../api/auth.api';
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

  useEffect(() => {
    // Initialize timezones list
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = COMMON_TIMEZONES.includes(userTz)
      ? COMMON_TIMEZONES
      : [userTz, ...COMMON_TIMEZONES];
    setTimezones(zones);
  }, []);

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
    </div>
  );
}
