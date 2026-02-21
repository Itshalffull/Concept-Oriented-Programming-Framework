// Conduit Example App -- React Native Profile Screen
// Displays user profile with bio, follow button, and authored articles.

import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useAuth } from '../App';
import * as api from '../api';
import type { Profile, Article } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const username = route.params?.username;
  const { user, setUser } = useAuth();
  const displayUsername = username || user?.username;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!displayUsername) return;
    loadProfile();
  }, [displayUsername]);

  const loadProfile = async () => {
    if (!displayUsername) return;
    try {
      setError(null);
      const [profileRes, articlesRes] = await Promise.all([
        api.getProfile(displayUsername),
        api.getArticles(),
      ]);
      setProfile(profileRes.profile);
      setArticles(articlesRes.articles.filter(a => a.author.username === displayUsername));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const res = profile.following
        ? await api.unfollow(profile.username)
        : await api.follow(profile.username);
      setProfile(res.profile);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    navigation.goBack();
  };

  if (!displayUsername) {
    return (
      <View style={styles.center}>
        <Text style={styles.noUser}>No user specified.</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5CB85C" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
      </View>
    );
  }

  const isOwnProfile = user?.username === profile.username;

  return (
    <FlatList
      data={articles}
      keyExtractor={item => item.slug}
      ListHeaderComponent={
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>{profile.username}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {isOwnProfile ? (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.followButton} onPress={handleFollow}>
              <Text style={styles.followText}>
                {profile.following ? 'Unfollow' : 'Follow'} {profile.username}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Articles by {profile.username}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.articleCard}
          onPress={() => navigation.navigate('Article', { slug: item.slug })}
        >
          <Text style={styles.articleTitle}>{item.title}</Text>
          <Text style={styles.articleDesc} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.articleDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No articles yet.</Text>
      }
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { paddingBottom: 20 },
  profileHeader: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#f5f5f5' },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#5CB85C',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  bio: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  followButton: {
    borderWidth: 1, borderColor: '#5CB85C', borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 8, marginTop: 16,
  },
  followText: { color: '#5CB85C', fontWeight: '600' },
  logoutButton: {
    borderWidth: 1, borderColor: '#e74c3c', borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 8, marginTop: 16,
  },
  logoutText: { color: '#e74c3c', fontWeight: '600' },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#333',
    marginTop: 24, alignSelf: 'flex-start', paddingHorizontal: 16,
  },
  articleCard: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
    padding: 16, borderRadius: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  articleTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  articleDesc: { fontSize: 13, color: '#666', marginBottom: 6 },
  articleDate: { fontSize: 11, color: '#aaa' },
  empty: { textAlign: 'center', color: '#999', padding: 20 },
  noUser: { fontSize: 16, color: '#666', marginBottom: 16 },
  loginButton: { backgroundColor: '#5CB85C', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 6 },
  loginButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  errorText: { color: '#e74c3c', fontSize: 16 },
});
