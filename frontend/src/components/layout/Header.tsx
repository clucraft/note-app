import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ThemeSwitcher } from '../themes/ThemeSwitcher';
import styles from './Header.module.css';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>📝</span>
        <span className={styles.logoText}>Notes</span>
      </div>

      <div className={styles.actions}>
        <ThemeSwitcher />

        <div className={styles.userMenu} ref={menuRef}>
          <button
            className={styles.userButton}
            onClick={() => setShowMenu(!showMenu)}
          >
            <span className={styles.avatar}>
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </span>
            <span className={styles.userName}>{user?.displayName}</span>
          </button>

          {showMenu && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownName}>{user?.displayName}</span>
                <span className={styles.dropdownEmail}>{user?.email}</span>
              </div>
              <div className={styles.dropdownDivider} />
              {user?.role === 'admin' && (
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    navigate('/admin/users');
                    setShowMenu(false);
                  }}
                >
                  Manage Users
                </button>
              )}
              <button className={styles.dropdownItem} onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
