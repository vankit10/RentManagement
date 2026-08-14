import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants';

/**
 * Shown while Firebase onAuthStateChanged resolves on app launch.
 */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoCard}>
        <Image
          source={require('../assets/images/logo.jpg')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Adarsh Infradevelopers logo"
        />
      </View>
      <ActivityIndicator
        size="large"
        color={Colors.accent}
        style={styles.spinner}
        accessibilityLabel="Loading"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 260,
    height: 78,
  },
  logoCard: {
    backgroundColor: Colors.textInverse,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 40,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  spinner: {
    marginTop: 40,
  },
});
