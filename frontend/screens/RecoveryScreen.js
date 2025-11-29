import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { emergencyClearAll } from '../utils/emergencyClear';

/**
 * TEMPORARY RECOVERY SCREEN
 * Use this to clear corrupted account data
 * Navigate here from anywhere with: navigation.navigate('RecoveryScreen')
 */
export default function RecoveryScreen({ navigation }) {
  const handleClearData = async () => {
    Alert.alert(
      'Clear All Account Data?',
      'This will log you out and clear all saved accounts. You will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            await emergencyClearAll();
            Alert.alert('Success', 'Account data cleared. Please restart the app and log in again.');
            // Navigate to login
            navigation.reset({
              index: 0,
              routes: [{ name: 'Landing' }],
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Recovery Mode</Text>
      <Text style={styles.description}>
        Use this screen to clear corrupted account data and fix authentication issues.
      </Text>
      
      <TouchableOpacity style={styles.button} onPress={handleClearData}>
        <Text style={styles.buttonText}>Clear All Account Data</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  button: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
  },
  cancelText: {
    color: '#6A0DAD',
    fontSize: 16,
  },
});
