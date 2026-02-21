import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article, Comment } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  slug: string;
  user: StoredUser | null;
  onBack: () => void;
}

export function ArticlePage({ api, slug, user, onBack }: Props) {
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentMode, setCommentMode] = useState(false);
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [artRes, comRes] = await Promise.all([
          api.getArticles().then(r => r.articles.find(a => a.slug === slug)),
          api.getComments(slug),
        ]);
        if (artRes) setArticle(artRes);
        setComments(comRes.comments);
      } catch (err: any) {
        setError(err.message || 'Failed to load article');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useInput((input, key) => {
    if (commentMode) return;
    if (key.escape) onBack();
    if (input === 'c' && user) setCommentMode(true);
  });

  async function submitComment() {
    if (!commentBody.trim()) { setCommentMode(false); return; }
    try {
      const res = await api.createComment(slug, commentBody);
      setComments(prev => [res.comment, ...prev]);
      setCommentBody('');
      setCommentMode(false);
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
      setCommentMode(false);
    }
  }

  if (loading) return <Text color="gray">Loading article...</Text>;
  if (!article) return <Text color="red">Article not found</Text>;

  return (
    <Box flexDirection="column">
      <Text bold color="white">{article.title}</Text>
      <Box marginBottom={1}>
        <Text color="gray">
          by {article.author.username} | {new Date(article.createdAt).toLocaleDateString()} | {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
        </Text>
      </Box>

      {article.tagList.length > 0 && (
        <Text color="cyan">{article.tagList.map(t => `#${t}`).join(' ')}</Text>
      )}

      <Box marginTop={1} marginBottom={1}>
        <Text>{article.body}</Text>
      </Box>

      {error && <Text color="red">{error}</Text>}

      <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
        <Text color="gray">
          Esc: back{user ? ' | [c] comment' : ''}
        </Text>
      </Box>

      {commentMode && (
        <Box>
          <Text color="green">Comment: </Text>
          <TextInput value={commentBody} onChange={setCommentBody} onSubmit={submitComment} />
        </Box>
      )}

      {comments.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Comments ({comments.length})</Text>
          {comments.map(comment => (
            <Box key={comment.id} flexDirection="column" marginTop={1}>
              <Text color="gray">
                {comment.author.username} - {new Date(comment.createdAt).toLocaleDateString()}
              </Text>
              <Text>{comment.body}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
