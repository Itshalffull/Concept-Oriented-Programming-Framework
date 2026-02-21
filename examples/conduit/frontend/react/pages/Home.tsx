import React, { useState, useEffect } from 'react';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  user: StoredUser | null;
}

export function Home({ api, user }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [articlesRes, tagsRes] = await Promise.all([
        api.getArticles(),
        api.getTags(),
      ]);
      setArticles(articlesRes.articles);
      setTags(tagsRes.tags);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(article: Article) {
    if (!user) { window.location.hash = '#/login'; return; }
    try {
      const res = article.favorited
        ? await api.unfavorite(article.slug)
        : await api.favorite(article.slug);
      setArticles(prev => prev.map(a => a.slug === article.slug ? res.article : a));
    } catch (err) {
      console.error('Favorite failed:', err);
    }
  }

  const displayed = selectedTag
    ? articles.filter(a => a.tagList.includes(selectedTag))
    : articles;

  return (
    <>
      <div className="banner">
        <h1>conduit</h1>
        <p>A place to share your knowledge.</p>
      </div>
      <div className="two-col">
        <div>
          {selectedTag && (
            <div style={{ marginBottom: 12 }}>
              Filtered by tag: <span className="tag">{selectedTag}</span>
              <button onClick={() => setSelectedTag(null)} style={{ marginLeft: 8, cursor: 'pointer', background: 'none', border: 'none', color: '#999' }}>
                &times; clear
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">Loading articles...</div>
          ) : displayed.length === 0 ? (
            <div className="loading">No articles yet.</div>
          ) : (
            displayed.map(article => (
              <div className="card" key={article.slug}>
                <div className="article-meta">
                  <img src={article.author.image || 'https://api.realworld.io/images/smiley-cyrus.jpeg'} alt="" />
                  <div>
                    <a href={`#/profile/${article.author.username}`}>{article.author.username}</a>
                    <div>{new Date(article.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => toggleFavorite(article)}>
                    {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
                  </button>
                </div>
                <a href={`#/article/${article.slug}`}>
                  <h2 style={{ margin: '8px 0 4px', color: '#333' }}>{article.title}</h2>
                  <p style={{ color: '#999', fontSize: '0.9rem' }}>{article.description}</p>
                </a>
                <div style={{ marginTop: 8 }}>
                  {article.tagList.map(tag => (
                    <span className="tag" key={tag} onClick={() => setSelectedTag(tag)}>{tag}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="card">
            <h4 style={{ marginBottom: 8 }}>Popular Tags</h4>
            {tags.length === 0 ? (
              <p style={{ color: '#999' }}>No tags yet</p>
            ) : (
              tags.map(tag => (
                <span className="tag" key={tag} onClick={() => setSelectedTag(tag)}>{tag}</span>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
