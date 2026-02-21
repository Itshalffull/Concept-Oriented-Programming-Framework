import React, { useState, useEffect } from 'react';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Profile as ProfileType, Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  username: string;
  user: StoredUser | null;
}

export function Profile({ api, username, user }: Props) {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, [username]);

  async function loadProfile() {
    setLoading(true);
    try {
      const [profileRes, articlesRes] = await Promise.all([
        api.getProfile(username),
        api.getArticles(),
      ]);
      setProfile(profileRes.profile);
      setArticles(articlesRes.articles.filter(a => a.author.username === username));
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow() {
    if (!profile || !user) return;
    try {
      const res = profile.following
        ? await api.unfollow(username)
        : await api.follow(username);
      setProfile(res.profile);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function toggleFavorite(article: Article) {
    if (!user) { window.location.hash = '#/login'; return; }
    try {
      const res = article.favorited
        ? await api.unfavorite(article.slug)
        : await api.favorite(article.slug);
      setArticles(prev => prev.map(a => a.slug === article.slug ? res.article : a));
    } catch (err: any) {
      console.error(err);
    }
  }

  if (loading) return <div className="loading">Loading profile...</div>;
  if (!profile) return <div className="loading">Profile not found</div>;

  const isOwn = user?.username === username;

  return (
    <div>
      <div className="profile-header">
        <img src={profile.image || 'https://api.realworld.io/images/smiley-cyrus.jpeg'} alt={profile.username} />
        <h2>{profile.username}</h2>
        {profile.bio && <p style={{ color: '#999', margin: '8px 0' }}>{profile.bio}</p>}
        {isOwn ? (
          <a href="#/settings" className="btn" style={{ marginTop: 8 }}>Edit Profile Settings</a>
        ) : user ? (
          <button className="btn" style={{ marginTop: 8 }} onClick={toggleFollow}>
            {profile.following ? 'Unfollow' : 'Follow'} {profile.username}
          </button>
        ) : null}
      </div>

      {error && <div className="error-msg">{error}</div>}

      <h3 style={{ marginBottom: 16 }}>Articles by {profile.username}</h3>
      {articles.length === 0 ? (
        <div className="loading">No articles yet.</div>
      ) : (
        articles.map(article => (
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
                <span className="tag" key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
