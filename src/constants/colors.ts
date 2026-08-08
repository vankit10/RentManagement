/**
 * Adarsh Infradevelopers And Construction — Brand Color Palette
 * Extracted from https://adarshinfra.co.in/
 *
 * Primary: Deep Navy Blue  — corporate identity, headers, nav bars
 * Accent:  Amber/Gold      — CTAs, highlights, badges
 * Supporting neutrals and semantic colors
 */

const Colors = {
  // ── Brand Primary ──────────────────────────────────────────
  primary: '#1A2A5E',        // deep navy blue — main brand color
  primaryDark: '#0F1A3D',    // darker navy for pressed states / headers
  primaryLight: '#2E4080',   // lighter navy for gradients / tab bars

  // ── Brand Accent ───────────────────────────────────────────
  accent: '#C9A84C',         // amber gold — buttons, highlights, icons
  accentDark: '#A87D2A',     // darker gold for pressed states
  accentLight: '#E8C97A',    // light gold for badges / chips

  // ── Backgrounds ────────────────────────────────────────────
  background: '#F5F6FA',     // off-white app background
  surface: '#FFFFFF',        // card / modal background
  surfaceSecondary: '#EFF1F8', // subtle tinted background for sections

  // ── Text ───────────────────────────────────────────────────
  textPrimary: '#1A1A2E',    // near-black for body text
  textSecondary: '#5A6075',  // grey for subtitles / meta
  textMuted: '#9AA0B4',      // muted for placeholders / disabled
  textInverse: '#FFFFFF',    // white text on dark surfaces
  textAccent: '#C9A84C',     // gold text for amounts / highlights

  // ── Borders & Dividers ──────────────────────────────────────
  border: '#DDE1EE',
  borderLight: '#ECEFF7',
  divider: '#E8EAF2',

  // ── Semantic ────────────────────────────────────────────────
  success: '#27AE60',        // paid / active
  successLight: '#E8F8EF',
  warning: '#F39C12',        // pending
  warningLight: '#FEF6E4',
  error: '#E74C3C',          // overdue / error
  errorLight: '#FDEDEB',
  info: '#2980B9',           // info banners
  infoLight: '#EBF5FB',

  // ── Status chips ────────────────────────────────────────────
  statusPaid: '#27AE60',
  statusPending: '#F39C12',
  statusOverdue: '#E74C3C',

  // ── Shadows ─────────────────────────────────────────────────
  shadow: 'rgba(26, 42, 94, 0.12)',
  shadowLight: 'rgba(26, 42, 94, 0.06)',

  // ── Overlay ─────────────────────────────────────────────────
  overlay: 'rgba(15, 26, 61, 0.55)',

  // ── Tab Bar ─────────────────────────────────────────────────
  tabActive: '#C9A84C',
  tabInactive: '#9AA0B4',
  tabBackground: '#FFFFFF',
};

export default Colors;
