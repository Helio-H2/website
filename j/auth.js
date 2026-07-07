// ─── HelioH₂ Tools Authentication Module ───────────────────────────────────
// Manages password-based access control via cookies
// Cookie: helioh2tools (encrypted password value, 2-hour expiry)

const HelioAuth = (() => {
  const COOKIE_NAME = 'helioh2tools';
  const COOKIE_EXPIRY_HOURS = 2;
  const SHIFT = 5; // Simple Caesar cipher shift for encryption/decryption

  // Simple Caesar cipher encryption
  function encryptPassword(password) {
    return password
      .split('')
      .map(char => {
        const charCode = char.charCodeAt(0);
        return String.fromCharCode(charCode + SHIFT);
      })
      .join('');
  }

  // Simple Caesar cipher decryption
  function decryptPassword(encrypted) {
    return encrypted
      .split('')
      .map(char => {
        const charCode = char.charCodeAt(0);
        return String.fromCharCode(charCode - SHIFT);
      })
      .join('');
  }

  // Validate password against algorithm
  function validatePassword(value) {
    const currentDay = String(new Date().getDate()).padStart(2, '0');
    if (value.length < 15) return 'Password troppo corta';
    if (!/[A-Za-z]{2}/.test(value.slice(0, 2))) return 'Hai sbagliato le prime due lettere';
    if (value.slice(2, 4) !== currentDay) return 'Hai sbagliato la 3º e la 4º lettera';
    if (!value.includes('HELIOH2')) return 'Deve contenere una parola fissa';
    if (!/(19\d{2}|20\d{2}|2100)/.test(value)) return 'Hai sbagliato anno';
    return '';
  }

  // Set auth cookie
  function setAuthCookie(password) {
    const encrypted = encryptPassword(password);
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + COOKIE_EXPIRY_HOURS);

    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(encrypted)}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Strict`;
  }

  // Get auth cookie
  function getAuthCookie() {
    const name = COOKIE_NAME + '=';
    const cookieArray = document.cookie.split(';');

    for (let cookie of cookieArray) {
      cookie = cookie.trim();
      if (cookie.indexOf(name) === 0) {
        return decodeURIComponent(cookie.substring(name.length));
      }
    }
    return null;
  }

  // Check if user is authenticated
  function isAuthenticated() {
    const encrypted = getAuthCookie();
    if (!encrypted) return false;

    try {
      const password = decryptPassword(encrypted);
      return validatePassword(password) === '';
    } catch {
      return false;
    }
  }

  // Redirect to login if not authenticated
  function requireAuth() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (!isAuthenticated()) {
          window.location.href = '/t/';
        }
      });
    } else {
      if (!isAuthenticated()) {
        window.location.href = '/t/';
      }
    }
  }

  // Handle login form submission
  function handleLogin(formId, passwordInputId, messageElementId, lockedElementId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const passwordInput = document.getElementById(passwordInputId);
    const messageEl = document.getElementById(messageElementId);
    const lockedEl = document.getElementById(lockedElementId);

    if (!passwordInput) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const password = passwordInput.value.trim();
      const error = validatePassword(password);

      if (error) {
        if (messageEl) {
          messageEl.textContent = error;
          messageEl.className = 'msg bad';
        }
        if (lockedEl) lockedEl.style.display = 'none';
        return;
      }

      // Password valid: set cookie and show success
      setAuthCookie(password);

      if (messageEl) {
        messageEl.textContent = 'Accesso consentito';
        messageEl.className = 'msg ok';
      }
      if (lockedEl) {
        lockedEl.style.display = 'block';
      }

      // Optional: redirect after short delay
      // setTimeout(() => { window.location.href = '/t/'; }, 500);
    });
  }

  // Public API
  return {
    validatePassword,
    setAuthCookie,
    getAuthCookie,
    isAuthenticated,
    requireAuth,
    handleLogin,
    encryptPassword,
    decryptPassword,
  };
})();
