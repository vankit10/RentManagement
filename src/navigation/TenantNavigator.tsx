import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { TenantTabParamList } from '../types';
import { Colors, FontSize } from '../constants';

import TenantDashboardScreen from '../screens/tenant/DashboardScreen';
import TenantRentScreen from '../screens/tenant/RentScreen';
import TenantElectricityScreen from '../screens/tenant/ElectricityScreen';
import TenantNotificationsScreen from '../screens/tenant/NotificationsScreen';
import TenantProfileScreen from '../screens/tenant/ProfileScreen';

const Tab = createBottomTabNavigator<TenantTabParamList>();

export default function TenantNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
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
            Home: 'home-outline',
            Rent: 'cash-multiple',
            Electricity: 'lightning-bolt-outline',
            Notifications: 'bell-outline',
            Profile: 'account-circle-outline',
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
      <Tab.Screen name="Home" component={TenantDashboardScreen} />
      <Tab.Screen name="Rent" component={TenantRentScreen} />
      <Tab.Screen name="Electricity" component={TenantElectricityScreen} />
      <Tab.Screen name="Notifications" component={TenantNotificationsScreen} />
      <Tab.Screen name="Profile" component={TenantProfileScreen} />
    </Tab.Navigator>
  );
}
