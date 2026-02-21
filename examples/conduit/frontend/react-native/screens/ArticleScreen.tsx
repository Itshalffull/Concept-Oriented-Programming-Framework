// Conduit Example App -- React Native Article Detail Screen
// Shows full article body, author info, and comments.

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useAuth } from '../App';
import * as api from '../api';
import type { Article, Comment } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Article'>;

export function ArticleScreen({ route, navigation }: Props): React.JSX.Element {
  const { slug } = route.params;
  const { user } = useAuth();

  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      setError(null);
      const [articleRes, commentsRes] = await Promise.all([
        api.getArticle(slug),
        api.getComments(slug),
      ]);
      setArticle(articleRes.article);
      setComments(commentsRes.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    if (!article) return;
    try {
      const res = article.favorited
        ? await api.unfavorite(slug)
        : await api.favorite(slug);
      setArticle(res.article);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleFollow = async () => {
    if (!article) return;
    try {
      const res = article.author.following
        ? await api.unfollow(article.author.username)
        : await api.follow(article.author.username);
      setArticle(prev =>
        prev ? { ...prev, author: res.profile } : prev
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createComment(slug, commentBody);
      setComments(prev => [res.comment, ...prev]);
      setCommentBody('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteComment(slug, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5CB85C" />
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Article not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{article.title}</Text>
        <View style={styles.meta}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile', { username: article.author.username })}
          >
            <Text style={styles.authorText}>{article.author.username}</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {new Date(article.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleFollow}>
            <Text style={styles.actionText}>
              {article.author.following ? 'Unfollow' : 'Follow'} {article.author.username}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleFavorite}>
            <Text style={[styles.actionText, article.favorited && styles.favActive]}>
              {article.favorited ? '\u2665' : '\u2661'} {article.favoritesCount}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.bodyText}>{article.body}</Text>
      </View>

      {article.tagList.length > 0 && (
        <View style={styles.tagRow}>
          {article.tagList.map(tag => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      )}

      <View style={styles.commentsSection}>
        <Text style={styles.commentsHeading}>Comments</Text>

        {user && (
          <View style={styles.commentForm}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              value={commentBody}
              onChangeText={setCommentBody}
              multiline
              editable={!submitting}
            />
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabled]}
              onPress={handleAddComment}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting ? 'Posting...' : 'Post Comment'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {comments.map(comment => (
          <View key={comment.id} style={styles.commentCard}>
            <Text style={styles.commentBody}>{comment.body}</Text>
            <View style={styles.commentMeta}>
              <Text style={styles.commentAuthor}>{comment.author.username}</Text>
              <Text style={styles.commentDate}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </Text>
              {user?.username === comment.author.username && (
                <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {comments.length === 0 && (
          <Text style={styles.noComments}>No comments yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: '#333', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  authorText: { color: '#5CB85C', fontWeight: '600' },
  dateText: { color: '#aaa', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    borderWidth: 1, borderColor: '#aaa', borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  actionText: { color: '#ccc', fontSize: 13 },
  favActive: { color: '#e74c3c' },
  body: { padding: 20 },
  bodyText: { fontSize: 16, lineHeight: 24, color: '#333' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, marginBottom: 16 },
  tag: {
    fontSize: 12, color: '#aaa', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  commentsSection: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  commentsHeading: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  commentForm: { marginBottom: 20 },
  commentInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 8,
  },
  submitButton: { backgroundColor: '#5CB85C', padding: 12, borderRadius: 6, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
  commentCard: {
    backgroundColor: '#f5f5f5', borderRadius: 6, padding: 12, marginBottom: 10,
  },
  commentBody: { fontSize: 14, color: '#333', marginBottom: 8 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { color: '#5CB85C', fontWeight: '600', fontSize: 12 },
  commentDate: { color: '#999', fontSize: 12 },
  deleteText: { color: '#e74c3c', fontSize: 12 },
  errorText: { color: '#e74c3c', fontSize: 16 },
  noComments: { color: '#999', fontStyle: 'italic' },
});
