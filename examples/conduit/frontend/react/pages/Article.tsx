import React, { useState, useEffect } from 'react';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article as ArticleType, Comment } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  slug: string;
  user: StoredUser | null;
}

export function Article({ api, slug, user }: Props) {
  const [article, setArticle] = useState<ArticleType | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadArticle();
  }, [slug]);

  async function loadArticle() {
    setLoading(true);
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
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    try {
      const res = await api.createComment(slug, commentBody);
      setComments(prev => [res.comment, ...prev]);
      setCommentBody('');
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    }
  }

  async function deleteComment(id: string) {
    try {
      await api.deleteComment(slug, id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment');
    }
  }

  async function deleteArticle() {
    try {
      await api.deleteArticle(slug);
      window.location.hash = '#/';
    } catch (err: any) {
      setError(err.message || 'Failed to delete article');
    }
  }

  async function toggleFavorite() {
    if (!article || !user) return;
    try {
      const res = article.favorited
        ? await api.unfavorite(slug)
        : await api.favorite(slug);
      setArticle(res.article);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function toggleFollow() {
    if (!article || !user) return;
    try {
      const res = article.author.following
        ? await api.unfollow(article.author.username)
        : await api.follow(article.author.username);
      setArticle(prev => prev ? { ...prev, author: res.profile } : prev);
    } catch (err: any) {
      console.error(err);
    }
  }

  if (loading) return <div className="loading">Loading article...</div>;
  if (!article) return <div className="loading">Article not found</div>;

  const isAuthor = user?.username === article.author.username;

  return (
    <div>
      <div style={{ background: '#333', color: '#fff', padding: '32px 0', marginBottom: 24, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 12 }}>{article.title}</h1>
        <div className="article-meta">
          <img src={article.author.image || 'https://api.realworld.io/images/smiley-cyrus.jpeg'} alt="" />
          <div>
            <a href={`#/profile/${article.author.username}`} style={{ color: '#fff' }}>{article.author.username}</a>
            <div style={{ color: '#bbb' }}>{new Date(article.createdAt).toLocaleDateString()}</div>
          </div>
          {isAuthor ? (
            <>
              <a href={`#/editor/${article.slug}`} className="btn" style={{ borderColor: '#ccc', color: '#ccc' }}>Edit</a>
              <button className="btn btn-danger" onClick={deleteArticle}>Delete</button>
            </>
          ) : (
            <>
              <button className="btn" style={{ borderColor: '#ccc', color: '#ccc' }} onClick={toggleFollow}>
                {article.author.following ? 'Unfollow' : 'Follow'} {article.author.username}
              </button>
              <button className="btn" onClick={toggleFavorite}>
                {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div style={{ lineHeight: 1.8, marginBottom: 32, whiteSpace: 'pre-wrap' }}>
        {article.body}
      </div>

      <div style={{ marginBottom: 16 }}>
        {article.tagList.map(tag => (
          <span className="tag" key={tag}>{tag}</span>
        ))}
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {user ? (
          <form onSubmit={submitComment} style={{ marginBottom: 24 }}>
            <textarea
              className="comment-form"
              placeholder="Write a comment..."
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 4, minHeight: 80, marginBottom: 8 }}
            />
            <button className="btn btn-primary" type="submit">Post Comment</button>
          </form>
        ) : (
          <p style={{ textAlign: 'center', marginBottom: 24, color: '#999' }}>
            <a href="#/login">Sign in</a> or <a href="#/register">sign up</a> to add comments.
          </p>
        )}

        {comments.map(comment => (
          <div className="comment card" key={comment.id}>
            <p style={{ marginBottom: 8 }}>{comment.body}</p>
            <div className="article-meta">
              <img src={comment.author.image || 'https://api.realworld.io/images/smiley-cyrus.jpeg'} alt="" />
              <a href={`#/profile/${comment.author.username}`}>{comment.author.username}</a>
              <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
              {user?.username === comment.author.username && (
                <button className="btn btn-danger" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => deleteComment(comment.id)}>
                  &times;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
