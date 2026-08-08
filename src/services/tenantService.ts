/**
 * Tenant Service — Phase 3 / 4
 * All Firestore reads are strictly scoped to the authenticated tenant's own data.
 * Security is also enforced server-side via Firestore security rules (Phase 8).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import type {
  Tenant,
  RentRecord,
  MeterReading,
  AppNotification,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tenant profile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the tenant document whose userId matches the logged-in uid.
 * Returns null if the owner hasn't created a tenant record yet.
 */
export async function getTenantByUserId(uid: string): Promise<Tenant | null> {
  const q = query(
    collection(db, 'tenants'),
    where('userId', '==', uid),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) { return null; }
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Tenant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rent records
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-time fetch of all rent records for a tenant, newest first.
 */
export async function getRentRecords(tenantId: string): Promise<RentRecord[]> {
  const q = query(
    collection(db, 'rentRecords'),
    where('tenantId', '==', tenantId),
    orderBy('dueDate', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RentRecord));
}

/**
 * Fetch the latest (most recent by dueDate) rent record for a tenant.
 */
export async function getLatestRentRecord(
  tenantId: string,
): Promise<RentRecord | null> {
  const q = query(
    collection(db, 'rentRecords'),
    where('tenantId', '==', tenantId),
    orderBy('dueDate', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) { return null; }
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as RentRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meter readings / electricity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-time fetch of all meter readings for a tenant, newest first.
 */
export async function getMeterReadings(
  tenantId: string,
): Promise<MeterReading[]> {
  const q = query(
    collection(db, 'meterReadings'),
    where('tenantId', '==', tenantId),
    orderBy('readingDate', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MeterReading));
}

/**
 * Fetch the latest meter reading for a tenant.
 */
export async function getLatestMeterReading(
  tenantId: string,
): Promise<MeterReading | null> {
  const q = query(
    collection(db, 'meterReadings'),
    where('tenantId', '==', tenantId),
    orderBy('readingDate', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) { return null; }
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as MeterReading;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real-time listener for a tenant's notifications, newest first.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToNotifications(
  tenantId: string,
  onData: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(
        d => ({ id: d.id, ...d.data() } as AppNotification),
      );
      onData(items);
    },
    err => onError?.(err),
  );
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
}

/**
 * Mark all unread notifications for a tenant as read.
 */
export async function markAllNotificationsRead(
  tenantId: string,
): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('tenantId', '==', tenantId),
    where('isRead', '==', false),
  );
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map(d => updateDoc(d.ref, { isRead: true })),
  );
}
