import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ArcadeOverlay from './ArcadeOverlay';
import { validateArcadeShare } from '../../api/arcade.api';
import styles from './Arcade.module.css';

/**
 * Public arcade page reached via a share link (/arcade/:token).
 * Validates the token, then renders the arcade full-screen. No auth, and no
 * access to anything else in the app.
 */
export default function ArcadePage() {
  const { token } = useParams<{ token: string }>();
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'Arcade';
    if (!token) {
      setValid(false);
      return;
    }
    validateArcadeShare(token).then(setValid);
  }, [token]);

  if (valid === null) {
    return <div className={styles.overlay} />;
  }

  if (!valid) {
    return (
      <div className={styles.overlay}>
        <div className={styles.title}>ARCADE</div>
        <div className={styles.subtitle}>THIS LINK IS INVALID OR HAS BEEN DISABLED</div>
      </div>
    );
  }

  return <ArcadeOverlay onClose={() => {}} shareToken={token} standalone />;
}
