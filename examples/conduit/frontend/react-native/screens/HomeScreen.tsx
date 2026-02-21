// Conduit Example App -- React Native Home Screen
// Displays the global article feed with pull-to-refresh.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useAuth } from '../App';
import * as api from '../api';
import type { Article } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getArticles();
      setArticles(res.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadArticles();
  }, [loadArticles]);

  const handleFavorite = async (slug: string, favorited: boolean) => {
    try {
      const res = favorited
        ? await api.unfavorite(slug)
        : await api.favorite(slug);
      setArticles(prev =>
        prev.map(a => (a.slug === slug ? res.article : a))
      );
    } catch {
      // Silently fail if not authenticated
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate(user ? 'Profile' as never : 'Login')}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>
            {user ? user.username : 'Sign In'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5CB85C" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadArticles} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderArticle = ({ item }: { item: Article }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Article', { slug: item.slug })}
    >
      <View style={styles.cardHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile', { username: item.author.username })}
        >
          <Text style={styles.authorText}>{item.author.username}</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.titleText}>{item.title}</Text>
      <Text style={styles.descText} numberOfLines={2}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <TouchableOpacity onPress={() => handleFavorite(item.slug, item.favorited)}>
          <Text style={[styles.favText, item.favorited && styles.favActive]}>
            {item.favorited ? '\u2665' : '\u2661'} {item.favoritesCount}
          </Text>
        </TouchableOpacity>
        {item.tagList.length > 0 && (
          <View style={styles.tagRow}>
            {item.tagList.slice(0, 3).map(tag => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={articles}
      keyExtractor={item => item.slug}
      renderItem={renderArticle}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5CB85C" />
      }
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No articles yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  authorText: { color: '#5CB85C', fontWeight: '600', fontSize: 14 },
  dateText: { color: '#999', fontSize: 12 },
  titleText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  descText: { fontSize: 14, color: '#666', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  favText: { fontSize: 14, color: '#999' },
  favActive: { color: '#e74c3c' },
  tagRow: { flexDirection: 'row', gap: 4 },
  tag: {
    fontSize: 11,
    color: '#aaa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  errorText: { color: '#e74c3c', fontSize: 16, marginBottom: 12 },
  retryButton: { backgroundColor: '#5CB85C', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#999', fontSize: 16 },
  headerButton: { marginRight: 8 },
  headerButtonText: { color: '#fff', fontWeight: '600' },
});
