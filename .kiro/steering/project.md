# Adarsh Infra — Rent Management System

React Native (0.86.2) + Firebase mobile app for Adarsh Infradevelopers & Construction, Lucknow.
Two roles: **Owner** (one account, pre-seeded in Firebase) and **Tenant** (registered by owner via phone number).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.86.2 (TypeScript) |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| Backend | Firebase (@react-native-firebase v26 — modular API) |
| Auth | Firebase Authentication (Phone OTP + Email/Password) |
| Database | Cloud Firestore |
| Push | Firebase Cloud Messaging |
| SMS | Twilio (via Firebase Cloud Functions — never called directly from RN) |
| State | React Context (AuthContext) |
| Icons | react-native-vector-icons/MaterialCommunityIcons |
| Dates | date-fns v4 |
| Toast | react-native-toast-message |

---

## Brand Theme (Adarsh Infra — adarshinfra.co.in)

- **Primary**: `#1A2A5E` deep navy blue
- **Accent**: `#C9A84C` amber gold (buttons, CTAs, highlights)
- **Background**: `#F5F6FA` off-white
- All constants live in `src/constants/colors.ts` and `src/constants/theme.ts`
- Logo and images: `src/assets/images/logo.jpg`, `login_bg.jpg`, `owner_avatar.jpg`

---

## Firebase — IMPORTANT: Modular API (v26)

**Always use named imports — there are NO default exports.**

```ts
// ✅ Correct
import { getAuth, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { getFirestore, collection, doc, getDocs, query, where } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

// ❌ Wrong — no default exports in v26
import auth from '@react-native-firebase/auth';
```

Singleton instances are exported from `src/services/firebase.ts`:
```ts
export const auth = getAuth();
export const db = getFirestore();
export const messaging = getMessaging();
```

---

## Twilio SMS Architecture

**CRITICAL: Never call Twilio directly from React Native.**

```
React Native
     ↓  (Firebase callable function)
Firebase Cloud Functions  (functions/src/index.ts)
     ↓  (server-side only)
Twilio
     ↓
Tenant Mobile Number
```

Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) are stored in **Firebase Secret Manager** only. They never appear in:
- React Native code
- `.env` files in the app bundle
- Firestore documents
- Client-side code of any kind

### SMS is sent for (only):
1. Tenant registration (owner registers tenant → SMS to tenant)
2. Rent due reminder (owner triggers)
3. Payment confirmation (owner records payment)

### SMS is NOT sent for:
- General notifications (use FCM push instead)
- Meter reading updates
- Electricity bill updates
- Owner announcements

### Cloud Function callable names:
- `sendTenantRegistrationSMS`
- `sendRentDueSMS`
- `sendPaymentConfirmationSMS`

SMS failures are logged to `smsFailureLogs` collection and do NOT block tenant registration.

---

## Tenant Registration & Login Flow

### Owner registers a tenant:
1. Owner fills Name + Phone (minimum required).
2. `createTenant()` in `tenantService.ts`:
   - Writes `tenants/{tenantId}` with `userId: ''` (empty until first login).
   - Writes `phoneTenantMap/{phone}` with `{ tenantId, linked: false }`.
   - Calls `sendTenantRegistrationSMS` Cloud Function (non-blocking).
3. Tenant receives SMS: _"Open the app and login using your mobile number with OTP."_

### Tenant first OTP login:
1. Tenant enters phone number → OTP sent via Firebase Phone Auth.
2. Tenant verifies OTP on `OTPVerifyScreen`.
3. `AuthContext` detects phone-auth user with no Firestore profile.
4. Calls `linkTenantAccountOnFirstLogin()`:
   - Looks up `phoneTenantMap/{phone}`.
   - If not found → `TENANT_NOT_REGISTERED` error → signs user out.
   - If found → creates `users/{uid}`, updates `tenants/{tenantId}.userId = uid`.
5. `AuthContext` fetches profile → routes to TenantApp.

### Subsequent logins:
- Firebase Auth session persists automatically (no manual AsyncStorage needed).
- `onAuthStateChanged` fires on app open and restores the session.
- User stays logged in until explicit logout or token revocation.

---

## Login Screen Modes

The `LoginScreen` has two tabs:
- **OTP Login** (default): enter phone number → navigate to `OTPVerifyScreen`.
- **Password Login**: enter phone + password → `signInWithPhone()` looks up email by phone and signs in.

Owner mode is auto-detected when the user types `@` in the phone field — it switches to email + password fields.

`ConfirmationResult` from Firebase Phone Auth cannot be serialised to JSON, so it is stored in **authService module scope** (not in navigation params). `OTPVerifyScreen` reads it via `getPendingConfirmation()`.

---

## Folder Structure

```
src/
├── assets/images/          logo.jpg, login_bg.jpg, owner_avatar.jpg
├── components/             AuthInput, StatusBadge, InfoRow, SectionHeader,
│                           EmptyState, ErrorBoundary
├── constants/              colors.ts, theme.ts (Spacing, Radius, FontSize, FontWeight, Shadow)
├── context/                AuthContext.tsx (onAuthStateChanged + role routing + phone-auth linking)
├── hooks/                  useAuth.ts, useNetworkStatus.ts
├── navigation/             AppNavigator, AuthNavigator, TenantNavigator, OwnerNavigator
├── screens/
│   ├── auth/               LoginScreen, OTPVerifyScreen, RegisterScreen, ForgotPasswordScreen
│   ├── tenant/             DashboardScreen, RentScreen, ElectricityScreen,
│   │                       NotificationsScreen, ProfileScreen
│   └── owner/              DashboardScreen, TenantsScreen, TenantDetailScreen,
│                           AddEditTenantScreen, PaymentsScreen, RecordPaymentScreen,
│                           ElectricityScreen, AddMeterReadingScreen,
│                           NotificationsScreen, SendNotificationScreen
├── services/               firebase.ts, authService.ts, tenantService.ts,
│                           rentService.ts, electricityService.ts, notificationService.ts
├── types/                  index.ts (all interfaces + nav param lists)
└── utils/                  helpers.ts, firebaseErrors.ts

functions/                  Firebase Cloud Functions (Node 20, TypeScript)
├── src/
│   ├── index.ts            Callable functions: sendTenantRegistrationSMS,
│   │                       sendRentDueSMS, sendPaymentConfirmationSMS
│   └── smsService.ts       Twilio client wrapper + message templates
├── package.json
└── tsconfig.json
```

---

## Firestore Data Model

```
users/{userId}              name, email?, phone, role, fcmToken?, createdAt
tenants/{tenantId}          userId, name, phone, email?, roomNumber, joiningDate,
                            status, rentAmount?, dueDate?
phoneTenantMap/{phone}      tenantId, linked, uid?, createdAt   ← phone→tenant index
rentRecords/{rentId}        tenantId, month(YYYY-MM), amount, dueDate, paidDate?,
                            status(Paid|Pending|Overdue), createdAt
meterReadings/{id}          tenantId, month(YYYY-MM), previousReading, currentReading,
                            unitsConsumed, rate, amount, readingDate
notifications/{id}          tenantId, title, message, type, isRead, createdAt
smsFailureLogs/{id}         type, tenantName, tenantPhone, error, createdAt, retried
```

---

## Navigation Structure

```
AppNavigator (root)
├── Auth (unauthenticated)
│   ├── Login
│   ├── OTPVerify          ← new: 6-digit OTP entry screen
│   ├── Register
│   └── ForgotPassword
├── TenantApp → TenantNavigator (bottom tabs)
│   ├── Home, Rent, Electricity, Notifications, Profile
└── OwnerApp → OwnerNavigator (stack)
    ├── OwnerTabs (bottom tabs)
    │   ├── Dashboard, Tenants, Payments, Electricity, Notifications
    └── Push screens
        ├── TenantDetail, AddEditTenant, RecordPayment,
            AddMeterReading, SendNotification
```

---

## Electricity — Month-Wise Readings

Each meter reading has a `month` field (YYYY-MM) enforcing one record per tenant per month.

Rules enforced in `electricityService.ts` and Firestore rules:
- `currentReading >= previousReading`
- No duplicate `(tenantId, month)` pair

Auto-fill: when adding a new reading, `previousReading` is pre-filled from the last recorded `currentReading`.

### Calculation:
```
Units Consumed = Current Reading - Previous Reading
Electricity Bill = Units Consumed × Rate (₹/unit, configurable per reading)
```

---

## Security Rules

Firestore rules are in `firestore.rules` at the project root.
Deploy with: `firebase deploy --only firestore:rules`

Key rules:
- `phoneTenantMap`: owner writes, any authed user reads; authed phone user can update own entry to set `linked=true`.
- `tenants`: owner full CRUD; tenant reads own doc via `userId == auth.uid`.
- `notifications`: tenant can only update `isRead` field.
- `smsFailureLogs`: written by Cloud Functions admin SDK only; owner can read.

---

## Build Commands

```bash
# Install JS dependencies
npm install

# Install Cloud Functions dependencies
npm install --prefix functions

# Build Cloud Functions
npm run build --prefix functions

# iOS — install pods
cd ios && pod install && cd ..

# Run on iOS simulator
npx react-native run-ios

# Run on Android emulator
npx react-native run-android

# TypeScript type check
node_modules/.bin/tsc --noEmit

# Deploy Cloud Functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Set Twilio secrets (run once before deploying functions)
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_PHONE_NUMBER
```

---

## Owner Account Setup

The owner account is **pre-seeded in Firebase** — not registered in the app.

1. Go to Firebase Console → Authentication → Add user manually (email/password)
2. In Firestore, create `users/{uid}`:
   ```json
   { "name": "Akash Verma", "email": "owner@adarshinfra.co.in",
     "phone": "9XXXXXXXXX", "role": "owner", "createdAt": "2026-08-08T00:00:00.000Z" }
   ```
3. The app routes to the Owner dashboard automatically after login.

---

## Phase Completion Status

| Phase | Description | Status |
|---|---|---|
| 1 | Firebase wiring, folder structure, navigation shell | ✅ Done |
| 2 | Authentication (Login, Register, ForgotPassword) | ✅ Done |
| 3 | Tenant screens (Dashboard, Rent, Electricity, Notifications, Profile) | ✅ Done |
| 4 | Owner dashboard + tenant management (list, detail, add, edit) | ✅ Done |
| 5 | Rent management (payments screen, record payment, overdue detection) | ✅ Done |
| 6 | Electricity management (meter readings, bill calculation) | ✅ Done |
| 7 | Push notifications (send, broadcast, FCM, owner history) | ✅ Done |
| 8 | Security rules, error boundary, network status hook | ✅ Done |
| 9 | Documentation, steering file | ✅ Done |
| 10 | Phone OTP login, phone-only tenant registration, Twilio SMS via Cloud Functions, month-wise meter readings, session persistence | ✅ Done |
