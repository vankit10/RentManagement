/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Codes: https://firebase.google.com/docs/auth/admin/errors
 */
export function getFirebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Something went wrong. Please try again.';
  }

  const code = (error as { code?: string }).code ?? '';

  switch (code) {
    // ── Login errors ────────────────────────────────────────
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the owner.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';

    // ── Registration errors ─────────────────────────────────
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. Please contact support.';

    // ── Password reset errors ───────────────────────────────
    case 'auth/missing-email':
      return 'Please enter your email address.';

    // ── Network errors ──────────────────────────────────────
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';

    default:
      return 'Something went wrong. Please try again.';
  }
}
