/**
 * Settings Screen - App configuration and user preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { regionId, setRegionId, cropId, setCropId, user, setUser } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [language, setLanguage] = useState('en');
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [notifs, offline, sync, lang, version] = await Promise.all([
        SecureStore.getItemAsync('notifications_enabled'),
        SecureStore.getItemAsync('offline_mode'),
        SecureStore.getItemAsync('auto_sync'),
        SecureStore.getItemAsync('language'),
        SecureStore.getItemAsync('app_version'),
      ]);
      setNotificationsEnabled(notifs !== 'false');
      setOfflineMode(offline === 'true');
      setAutoSync(sync !== 'false');
      setLanguage(lang || 'en');
      setAppVersion(version || '1.0.0');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => setUser(null), style: 'destructive' },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: async () => {
          try {
            await SecureStore.deleteItemAsync('cached_regions');
            await SecureStore.deleteItemAsync('cached_crops');
            await SecureStore.deleteItemAsync('cached_diseases');
            Alert.alert('Success', 'Cache cleared successfully');
          } catch (err) {
            Alert.alert('Error', 'Failed to clear cache');
          }
        }, style: 'destructive' },
      ]
    );
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      {user && (
        <View style={styles.section}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase() || 'F'}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name || 'Farmer'}</Text>
              <Text style={styles.profileEmail}>{user.email || 'farmer@example.com'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Region & Crop Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Farm Settings</Text>
        <SettingRow
          label="Region"
          value={regionId || 'Not selected'}
          icon="location"
          onPress={() => { /* navigate to region selector */ }}
        />
        <SettingRow
          label="Primary Crop"
          value={cropId || 'Not selected'}
          icon="leaf"
          onPress={() => { /* navigate to crop selector */ }}
        />
      </View>

      {/* App Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <ToggleSetting
          label="Push Notifications"
          description="Receive disease alerts and weather updates"
          value={notificationsEnabled}
          onChange={(val) => { setNotificationsEnabled(val); saveSetting('notifications_enabled', String(val)); }}
          icon="notifications"
        />
        <ToggleSetting
          label="Offline Mode"
          description="Enable edge inference for offline disease detection"
          value={offlineMode}
          onChange={(val) => { setOfflineMode(val); saveSetting('offline_mode', String(val)); }}
          icon="wifi-off"
        />
        <ToggleSetting
          label="Auto Sync"
          description="Automatically sync data when online"
          value={autoSync}
          onChange={(val) => { setAutoSync(val); saveSetting('auto_sync', String(val)); }}
          icon="sync"
        />
        <SettingRow
          label="Language"
          value={language.toUpperCase()}
          icon="globe"
          onPress={() => { /* show language picker */ }}
        />
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Storage</Text>
        <SettingRow
          label="Clear Cache"
          description="Remove temporary files and cached data"
          icon="trash"
          onPress={handleClearCache}
          destructive
        />
        <SettingRow
          label="Export Data"
          description="Download your scan history and settings"
          icon="download"
          onPress={() => { /* export data */ }}
        />
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <SettingRow
          label="Version"
          value={appVersion}
          icon="information-circle"
        />
        <SettingRow
          label="Privacy Policy"
          icon="document"
          onPress={() => { /* open privacy policy */ }}
        />
        <SettingRow
          label="Terms of Service"
          icon="document-text"
          onPress={() => { /* open terms */ }}
        />
        <SettingRow
          label="Open Source Licenses"
          icon="logo-github"
          onPress={() => { /* show licenses */ }}
        />
      </View>

      {/* Account Actions */}
      {user && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>AgriSense - Empowering farmers with AI</Text>
        <Text style={styles.footerText}>Built with ❤️ for smallholder farmers worldwide</Text>
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  description,
  icon,
  onPress,
  destructive = false,
}: {
  label: string;
  value?: string;
  description?: string;
  icon: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={22} color={destructive ? '#EF4444' : '#666'} />
      <View style={styles.settingContent} flex={1}>
        <Text style={[styles.settingLabel, destructive && styles.settingLabelDestructive]}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      {value && <Text style={[styles.settingValue, destructive && styles.settingValueDestructive]}>{value}</Text>}
      {onPress && !destructive && <Ionicons name="chevron-forward" size={22} color="#999" />}
    </TouchableOpacity>
  );
}

function ToggleSetting({
  label,
  description,
  value,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (val: boolean) => void;
  icon: string;
}) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={22} color="#666" />
      <View style={styles.settingContent} flex={1}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? '#10B981' : '#fff'}
        trackColor={{ false: '#D1D5DB', true: '#10B981' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 100 },

  section: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#666', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  profileRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#111' },
  profileEmail: { fontSize: 14, color: '#666', marginTop: 2 },

  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '500', color: '#111' },
  settingLabelDestructive: { color: '#EF4444' },
  settingDescription: { fontSize: 13, color: '#666', marginTop: 2 },
  settingValue: { fontSize: 15, color: '#666', fontWeight: '500' },
  settingValueDestructive: { color: '#EF4444' },

  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },

  footer: { padding: 24, alignItems: 'center' },
  footerText: { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 4 },
});