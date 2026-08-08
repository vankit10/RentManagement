import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { OwnerStackParamList, OwnerTabParamList } from '../types';
import { Colors, FontSize } from '../constants';

// Owner tab screens
import OwnerDashboardScreen from '../screens/owner/DashboardScreen';
import OwnerTenantsScreen from '../screens/owner/TenantsScreen';
import OwnerPaymentsScreen from '../screens/owner/PaymentsScreen';
import OwnerElectricityScreen from '../screens/owner/ElectricityScreen';
import OwnerNotificationsScreen from '../screens/owner/NotificationsScreen';

// Owner stack push screens
import TenantDetailScreen from '../screens/owner/TenantDetailScreen';
import AddEditTenantScreen from '../screens/owner/AddEditTenantScreen';
import RecordPaymentScreen from '../screens/owner/RecordPaymentScreen';
import AddMeterReadingScreen from '../screens/owner/AddMeterReadingScreen';
import SendNotificationScreen from '../screens/owner/SendNotificationScreen';

// ─── Owner bottom tabs ────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<OwnerTabParamList>();

function OwnerTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBackground,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '500',
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'view-dashboard-outline',
            Tenants: 'account-group-outline',
            Payments: 'cash-check',
            Electricity: 'lightning-bolt-outline',
            Notifications: 'bell-outline',
          };
          return (
            <Icon
              name={icons[route.name] ?? 'circle-outline'}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={OwnerDashboardScreen} />
      <Tab.Screen name="Tenants" component={OwnerTenantsScreen} />
      <Tab.Screen name="Payments" component={OwnerPaymentsScreen} />
      <Tab.Screen name="Electricity" component={OwnerElectricityScreen} />
      <Tab.Screen name="Notifications" component={OwnerNotificationsScreen} />
    </Tab.Navigator>
  );
}

// ─── Owner root stack (tabs + push screens) ───────────────────────────────────

const Stack = createNativeStackNavigator<OwnerStackParamList>();

export default function OwnerNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="OwnerTabs"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
      <Stack.Screen name="TenantDetail" component={TenantDetailScreen} />
      <Stack.Screen name="AddEditTenant" component={AddEditTenantScreen} />
      <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} />
      <Stack.Screen name="AddMeterReading" component={AddMeterReadingScreen} />
      <Stack.Screen name="SendNotification" component={SendNotificationScreen} />
    </Stack.Navigator>
  );
}
