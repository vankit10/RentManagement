/**
 * Firebase service initialisation — @react-native-firebase v26 modular API
 * Auto-initialises from google-services.json (Android) / GoogleService-Info.plist (iOS)
 * Re-exports singleton instances used across the app.
 */
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getMessaging } from '@react-native-firebase/messaging';

export const auth = getAuth();
export const db = getFirestore();
export const messaging = getMessaging();
