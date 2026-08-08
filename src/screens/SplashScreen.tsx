import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants';

/**
 * Shown while Firebase onAuthStateChanged resolves on app launch.
 */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.jpg')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Adarsh Infradevelopers logo"
      />
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
    width: 280,
    height: 90,
    tintColor: Colors.textInverse,
  },
  spinner: {
    marginTop: 40,
  },
});
