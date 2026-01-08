import { useState, useEffect } from 'react';
import { listUserShares, deleteShare, type UserShare } from '../../api/share.api';
import { getTwoFAStatus, setupTwoFA, enableTwoFA, disableTwoFA, type TwoFASetup } from '../../api/twofa.api';
import styles from './SecuritySettings.module.css';

export function SecuritySettings() {
  const [shares, setShares] = useState<UserShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [twoFASetup, setTwoFASetup] = useState<TwoFASetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFASuccess, setTwoFASuccess] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadShares();
    loadTwoFAStatus();
  }, []);

  const loadShares = async () => {
    try {
      const data = await listUserShares();
      setShares(data);
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTwoFAStatus = async () => {
    try {
      const status = await getTwoFAStatus();
      setTwoFAEnabled(status.enabled);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleSetupTwoFA = async () => {
    setIsSettingUp(true);
    setTwoFAError('');
    setTwoFASuccess('');
    try {
      const setup = await setupTwoFA();
      setTwoFASetup(setup);
    } catch (error: any) {
      setTwoFAError(error.response?.data?.error || 'Failed to set up 2FA');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleEnableTwoFA = async () => {
    if (verificationCode.length !== 6) {
      setTwoFAError('Please enter a 6-digit code');
      return;
    }
    setIsVerifying(true);
    setTwoFAError('');
    try {
      await enableTwoFA(verificationCode);
      setTwoFAEnabled(true);
      setTwoFASetup(null);
      setVerificationCode('');
      setTwoFASuccess('2FA has been enabled successfully!');
    } catch (error: any) {
      setTwoFAError(error.response?.data?.error || 'Failed to verify code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisableTwoFA = async () => {
    if (verificationCode.length !== 6) {
      setTwoFAError('Please enter a 6-digit code');
      return;
    }
    setIsVerifying(true);
    setTwoFAError('');
    try {
      await disableTwoFA(verificationCode);
      setTwoFAEnabled(false);
      setVerificationCode('');
      setTwoFASuccess('2FA has been disabled.');
    } catch (error: any) {
      setTwoFAError(error.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelSetup = () => {
    setTwoFASetup(null);
    setVerificationCode('');
    setTwoFAError('');
  };

  const handleStopSharing = async (share: UserShare) => {
    setDeletingId(share.id);
    try {
      await deleteShare(share.noteId);
      setShares(shares.filter(s => s.id !== share.id));
    } catch (error) {
      console.error('Failed to stop sharing:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    // SQLite stores dates in UTC without timezone indicator
    // Append 'Z' if no timezone info to ensure correct parsing as UTC
    const isoDateStr = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
    return new Date(isoDateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>Security Settings</h2>

      {/* Two-Factor Authentication Section */}
      <div className={styles.section}>
        <h3 className={styles.label}>Two-Factor Authentication</h3>
        <p className={styles.description}>
          Add an extra layer of security to your account by requiring a code from your authenticator app.
        </p>

        {twoFALoading ? (
          <div className={styles.loading}>Loading 2FA status...</div>
        ) : twoFAEnabled ? (
          <div className={styles.twoFABox}>
            <div className={styles.twoFAStatus}>
              <span className={styles.statusEnabled}>Enabled</span>
              <span className={styles.statusText}>Your account is protected with 2FA</span>
            </div>
            <div className={styles.twoFADisable}>
              <p className={styles.disableText}>To disable 2FA, enter a code from your authenticator app:</p>
              <div className={styles.codeInputRow}>
                <input
                  type="text"
                  className={styles.codeInput}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <button
                  className={styles.disableButton}
                  onClick={handleDisableTwoFA}
                  disabled={isVerifying}
                >
                  {isVerifying ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          </div>
        ) : twoFASetup ? (
          <div className={styles.twoFABox}>
            <div className={styles.setupSteps}>
              <p className={styles.stepLabel}>1. Scan this QR code with your authenticator app:</p>
              <div className={styles.qrCodeWrapper}>
                <img src={twoFASetup.qrCode} alt="2FA QR Code" className={styles.qrCode} />
              </div>
              <p className={styles.manualEntry}>
                Or enter this code manually: <code className={styles.secret}>{twoFASetup.secret}</code>
              </p>
              <p className={styles.stepLabel}>2. Enter the 6-digit code from your app to verify:</p>
              <div className={styles.codeInputRow}>
                <input
                  type="text"
                  className={styles.codeInput}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <button
                  className={styles.verifyButton}
                  onClick={handleEnableTwoFA}
                  disabled={isVerifying}
                >
                  {isVerifying ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={handleCancelSetup}
                  disabled={isVerifying}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className={styles.setupButton}
            onClick={handleSetupTwoFA}
            disabled={isSettingUp}
          >
            {isSettingUp ? 'Setting up...' : 'Set Up 2FA'}
          </button>
        )}

        {twoFAError && <div className={styles.twoFAError}>{twoFAError}</div>}
        {twoFASuccess && <div className={styles.twoFASuccess}>{twoFASuccess}</div>}
      </div>

      <div className={styles.section}>
        <h3 className={styles.label}>Shared Notes</h3>
        <p className={styles.description}>
          Manage your publicly shared notes. Stop sharing to revoke access.
        </p>

        {isLoading ? (
          <div className={styles.loading}>Loading shared notes...</div>
        ) : shares.length === 0 ? (
          <div className={styles.empty}>
            You don't have any shared notes.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Shared On</th>
                  <th>Views</th>
                  <th>Protection</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <tr key={share.id}>
                    <td className={styles.noteCell}>
                      {share.noteTitleEmoji && (
                        <span className={styles.emoji}>{share.noteTitleEmoji}</span>
                      )}
                      <span className={styles.noteTitle}>{share.noteTitle}</span>
                    </td>
                    <td>{formatDate(share.createdAt)}</td>
                    <td>{share.viewCount}</td>
                    <td>
                      {share.hasPassword ? (
                        <span className={styles.badge}>Password</span>
                      ) : (
                        <span className={styles.badgeNone}>Public</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={styles.stopButton}
                        onClick={() => handleStopSharing(share)}
                        disabled={deletingId === share.id}
                      >
                        {deletingId === share.id ? 'Stopping...' : 'Stop Sharing'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
