/**
 * Firebase — FCM only
 *
 * Firebase is used exclusively for push notifications (FCM).
 * All auth and database operations use Supabase.
 *
 * Auto-initialises from google-services.json (Android) / GoogleService-Info.plist (iOS).
 */
import { getMessaging } from '@react-native-firebase/messaging';

export const messaging = getMessaging();
