import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useNotes } from '../../hooks/useNotes';
import { ThemeSwitcher } from '../themes/ThemeSwitcher';
import { searchNotes, SearchResult } from '../../api/notes.api';
import { summarizeSearchResults } from '../../api/ai.api';
import styles from './Header.module.css';

interface HeaderProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const { user, logout } = useAuth();
  const { selectNote } = useNotes();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
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
      setSummary(null);
      return;
    }

    setIsSearching(true);
    setSummary(null);
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

  const handleSummarize = useCallback(async () => {
    if (searchResults.length === 0) return;

    setIsSummarizing(true);
    try {
      const summaryText = await summarizeSearchResults(
        searchResults.map(r => ({ title: r.title, preview: r.preview }))
      );
      setSummary(summaryText);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to summarize';
      setSummary(`Error: ${errorMsg}`);
    } finally {
      setIsSummarizing(false);
    }
  }, [searchResults]);

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
        {onToggleSidebar && (
          <button
            className={styles.sidebarToggle}
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? '☰' : '◀'}
          </button>
        )}
        <span className={styles.logoText}>Cache</span>
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
            <div className={styles.searchHeader}>
              <span className={styles.resultCount}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
              <button
                className={styles.summarizeButton}
                onClick={handleSummarize}
                disabled={isSummarizing}
                title="Summarize with AI"
              >
                {isSummarizing ? '...' : '✨'}
              </button>
            </div>
            {summary && (
              <div className={`${styles.summary} ${summary.startsWith('Error:') ? styles.summaryError : ''}`}>
                {summary}
              </div>
            )}
            {searchResults.map(result => (
              <button
                key={result.id}
                className={styles.searchResult}
                onClick={() => handleResultClick(result.id)}
              >
                <span className={styles.resultTitle}>
                  {result.titleEmoji && <span className={styles.resultEmoji}>{result.titleEmoji}</span>}
                  {result.title}
                  {result.matchType === 'semantic' && (
                    <span className={styles.semanticBadge} title="Found by meaning, not exact match">
                      similar
                    </span>
                  )}
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
        <a
          href="https://buymeacoffee.com/clucraft"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.coffeeButton}
        >
          <span className={styles.coffeeEmoji}>☕</span>
          coffee
        </a>
        <ThemeSwitcher />

        <div className={styles.userMenu} ref={menuRef}>
          <button
            className={styles.userButton}
            onClick={() => setShowMenu(!showMenu)}
          >
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt="" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatar}>
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
            <span className={styles.userName}>{user?.displayName}</span>
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                className={styles.dropdown}
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                  mass: 0.8,
                }}
                style={{ transformOrigin: 'top right' }}
              >
                <div className={styles.dropdownHeader}>
                  <span className={styles.dropdownName}>{user?.displayName}</span>
                  <span className={styles.dropdownEmail}>{user?.email}</span>
                </div>
                <div className={styles.dropdownDivider} />
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    navigate('/profile');
                    setShowMenu(false);
                  }}
                >
                  Profile
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    navigate('/deleted');
                    setShowMenu(false);
                  }}
                >
                  Deleted Notes
                </button>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
