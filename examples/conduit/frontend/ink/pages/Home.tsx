import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  user: StoredUser | null;
  onOpenArticle: (slug: string) => void;
  onNavigate: (screen: string) => void;
}

export function Home({ api, user, onOpenArticle, onNavigate }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [artRes, tagRes] = await Promise.all([
          api.getArticles(),
          api.getTags(),
        ]);
        setArticles(artRes.articles);
        setTags(tagRes.tags);
      } catch (err: any) {
        setError(err.message || 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useInput((input, key) => {
    if (loading) return;

    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1));
    } else if (key.downArrow) {
      setSelected(s => Math.min(articles.length - 1, s + 1));
    } else if (key.return && articles.length > 0) {
      onOpenArticle(articles[selected].slug);
    } else if (input === 'l' && !user) {
      onNavigate('login');
    } else if (input === 'r' && !user) {
      onNavigate('register');
    } else if (input === 'n' && user) {
      onNavigate('editor');
    }
  });

  if (loading) return <Text color="gray">Loading articles...</Text>;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="green">A place to share your knowledge.</Text>
      </Box>

      {articles.length === 0 ? (
        <Text color="gray">No articles yet.</Text>
      ) : (
        <Box flexDirection="column">
          {articles.map((article, i) => (
            <Box key={article.slug} marginBottom={1}>
              <Text color={i === selected ? 'green' : 'white'}>
                {i === selected ? '> ' : '  '}
              </Text>
              <Box flexDirection="column">
                <Text bold color={i === selected ? 'green' : 'white'}>
                  {article.title}
                </Text>
                <Text color="gray">
                  by {article.author.username} | {new Date(article.createdAt).toLocaleDateString()} | {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
                </Text>
                <Text color="gray" dimColor>{article.description}</Text>
                {article.tagList.length > 0 && (
                  <Text color="cyan">{article.tagList.map(t => `#${t}`).join(' ')}</Text>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          Use arrow keys to navigate, Enter to read article
          {user ? ', [n] new article' : ', [l] login, [r] register'}
        </Text>
      </Box>

      {tags.length > 0 && (
        <Box marginTop={1}>
          <Text color="gray">Tags: </Text>
          <Text color="cyan">{tags.map(t => `#${t}`).join(' ')}</Text>
        </Box>
      )}
    </Box>
  );
}
