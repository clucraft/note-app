import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GeneralSettings } from './GeneralSettings';
import { SecuritySettings } from './SecuritySettings';
import { MembersSettings } from './MembersSettings';
import { AISettings } from './AISettings';
import styles from './Settings.module.css';

type SettingsSection = 'general' | 'ai' | 'security' | 'members';

export function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSettings />;
      case 'ai':
        return <AISettings />;
      case 'security':
        return <SecuritySettings />;
      case 'members':
        return user?.role === 'admin' ? <MembersSettings /> : null;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')}>
          &larr; Back to Notes
        </button>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.content}>
        <nav className={styles.sidebar}>
          <div className={styles.navSection}>
            <button
              className={`${styles.navItem} ${activeSection === 'general' ? styles.active : ''}`}
              onClick={() => setActiveSection('general')}
            >
              <span className={styles.navIcon}>⚙️</span>
              General
            </button>
            <button
              className={`${styles.navItem} ${activeSection === 'ai' ? styles.active : ''}`}
              onClick={() => setActiveSection('ai')}
            >
              <span className={styles.navIcon}>✨</span>
              AI
            </button>
            <button
              className={`${styles.navItem} ${activeSection === 'security' ? styles.active : ''}`}
              onClick={() => setActiveSection('security')}
            >
              <span className={styles.navIcon}>🔒</span>
              Security
            </button>
            {user?.role === 'admin' && (
              <button
                className={`${styles.navItem} ${activeSection === 'members' ? styles.active : ''}`}
                onClick={() => setActiveSection('members')}
              >
                <span className={styles.navIcon}>👥</span>
                Members
              </button>
            )}
          </div>
        </nav>

        <main className={styles.main}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
