import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotes } from '../../hooks/useNotes';
import { ThemeSwitcher } from '../themes/ThemeSwitcher';
import { searchNotes, SearchResult } from '../../api/notes.api';
import styles from './Header.module.css';

export function Header() {
  const { user, logout } = useAuth();
  const { selectNote } = useNotes();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchNotes(query);
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleResultClick = (noteId: number) => {
    selectNote(noteId);
    setShowResults(false);
    setSearchQuery('');
  };

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

      <div className={styles.searchContainer} ref={searchRef}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search notes..."
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
        />
        {isSearching && <span className={styles.searchSpinner} />}

        {showResults && searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map(result => (
              <button
                key={result.id}
                className={styles.searchResult}
                onClick={() => handleResultClick(result.id)}
              >
                <span className={styles.resultTitle}>
                  {result.titleEmoji && <span className={styles.resultEmoji}>{result.titleEmoji}</span>}
                  {result.title}
                </span>
                <span className={styles.resultPreview}>{result.preview}</span>
              </button>
            ))}
          </div>
        )}

        {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div className={styles.searchResults}>
            <div className={styles.noResults}>No notes found</div>
          </div>
        )}
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
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  navigate('/settings');
                  setShowMenu(false);
                }}
              >
                Settings
              </button>
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
