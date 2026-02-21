import React, { useState } from 'react';
import type { ConduitAPI } from '../../shared/api-client.js';

interface Props {
  api: ConduitAPI;
  slug?: string;
}

export function Editor({ api, slug }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !tagList.includes(tag)) {
        setTagList(prev => [...prev, tag]);
      }
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setTagList(prev => prev.filter(t => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.createArticle(title, description, body, tagList);
      window.location.hash = `#/article/${res.article.slug}`;
    } catch (err: any) {
      setError(err.message || 'Failed to publish article');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>{slug ? 'Edit Article' : 'New Article'}</h1>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Article Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="text"
            placeholder="What's this article about?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <textarea
            placeholder="Write your article (in markdown)"
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ minHeight: 200 }}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="text"
            placeholder="Enter tags (press Enter to add)"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag}
          />
          <div style={{ marginTop: 8 }}>
            {tagList.map(tag => (
              <span className="tag" key={tag} onClick={() => removeTag(tag)} style={{ cursor: 'pointer' }}>
                &times; {tag}
              </span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Publishing...' : 'Publish Article'}
        </button>
      </form>
    </div>
  );
}
