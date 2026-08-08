/**
 * Auth Service — Phase 2
 * Handles tenant registration, login, logout, password reset via Firebase Auth v26 modular API.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from '@react-native-firebase/auth';
import { doc, setDoc } from '@react-native-firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '../types';

/**
 * Register a new tenant with Firebase Auth and create their Firestore profile.
 */
export async function registerTenant(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<void> {
  const { name, email, phone, password } = params;

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { uid } = credential.user;

  const profile: Omit<UserProfile, 'uid'> = {
    name,
    email,
    phone,
    role: 'tenant',
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', uid), profile);
}

/**
 * Sign in with email and password (both roles).
 */
export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the current user.
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Send a password reset email (Firebase Auth handles the flow).
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}
