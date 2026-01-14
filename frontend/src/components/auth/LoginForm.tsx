import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getRegistrationStatus } from '../../api/settings.api';
import { Button } from '../common/Button';
import styles from './AuthForm.module.css';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getRegistrationStatus()
      .then((data) => setRegistrationEnabled(data.registrationEnabled))
      .catch(() => setRegistrationEnabled(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login({ email, password, totpCode: totpCode || undefined });
      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequiresTwoFactor(false);
    setTotpCode('');
    setError('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <h1 className={styles.title}>
          {requiresTwoFactor ? 'Two-Factor Authentication' : 'Welcome Back'}
        </h1>
        <p className={styles.subtitle}>
          {requiresTwoFactor
            ? 'Enter the code from your authenticator app'
            : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {!requiresTwoFactor ? (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </>
          ) : (
            <div className={styles.formGroup}>
              <label htmlFor="totpCode" className={styles.label}>
                Authentication Code
              </label>
              <input
                id="totpCode"
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${styles.input} ${styles.codeInput}`}
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
              />
            </div>
          )}

          <Button type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading
              ? requiresTwoFactor ? 'Verifying...' : 'Signing in...'
              : requiresTwoFactor ? 'Verify' : 'Sign In'}
          </Button>

          {requiresTwoFactor && (
            <button
              type="button"
              className={styles.backLink}
              onClick={handleBackToLogin}
            >
              Back to login
            </button>
          )}
        </form>

        {!requiresTwoFactor && registrationEnabled && (
          <p className={styles.footer}>
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        )}
      </div>
    </div>
  );
}
