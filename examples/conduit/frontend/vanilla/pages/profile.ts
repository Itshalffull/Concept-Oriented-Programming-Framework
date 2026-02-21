import type { ConduitAPI } from '../../shared/api-client.js';
import type { Profile, Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

export async function renderProfile(container: HTMLElement, api: ConduitAPI, username: string, user: StoredUser | null) {
  container.innerHTML = '<div class="loading">Loading profile...</div>';

  let profile: Profile | undefined;
  let articles: Article[] = [];

  try {
    const [profileRes, articlesRes] = await Promise.all([
      api.getProfile(username),
      api.getArticles(),
    ]);
    profile = profileRes.profile;
    articles = articlesRes.articles.filter(a => a.author.username === username);
  } catch (err: any) {
    container.innerHTML = `<div class="error-msg">${err.message || 'Failed to load profile'}</div>`;
    return;
  }

  if (!profile) {
    container.innerHTML = '<div class="loading">Profile not found</div>';
    return;
  }

  render();

  function render() {
    if (!profile) return;
    const isOwn = user?.username === username;

    container.innerHTML = `
      <div class="profile-header">
        <img src="${profile.image || defaultImg}" alt="${profile.username}" />
        <h2>${profile.username}</h2>
        ${profile.bio ? `<p style="color:#999;margin:8px 0">${profile.bio}</p>` : ''}
        ${isOwn
          ? `<a href="#/settings" class="btn" style="margin-top:8px">Edit Profile Settings</a>`
          : user
            ? `<button class="btn" id="follow-btn" style="margin-top:8px">${profile.following ? 'Unfollow' : 'Follow'} ${profile.username}</button>`
            : ''
        }
      </div>
      <h3 style="margin-bottom:16px">Articles by ${profile.username}</h3>
      <div id="profile-articles"></div>
    `;

    renderArticles();

    const followBtn = document.getElementById('follow-btn');
    if (followBtn) {
      followBtn.addEventListener('click', async () => {
        if (!profile || !user) return;
        try {
          const res = profile.following
            ? await api.unfollow(username)
            : await api.follow(username);
          profile = res.profile;
          render();
        } catch (err) {
          console.error(err);
        }
      });
    }
  }

  function renderArticles() {
    const el = document.getElementById('profile-articles')!;
    if (articles.length === 0) {
      el.innerHTML = '<div class="loading">No articles yet.</div>';
      return;
    }

    el.innerHTML = articles.map(article => `
      <div class="card">
        <div class="article-meta">
          <img src="${article.author.image || defaultImg}" alt="" />
          <div>
            <a href="#/profile/${article.author.username}">${article.author.username}</a>
            <div>${new Date(article.createdAt).toLocaleDateString()}</div>
          </div>
          <button class="btn fav-btn" data-slug="${article.slug}" style="margin-left:auto">
            ${article.favorited ? '\u2764' : '\u2661'} ${article.favoritesCount}
          </button>
        </div>
        <a href="#/article/${article.slug}">
          <h2 style="margin:8px 0 4px;color:#333">${article.title}</h2>
          <p style="color:#999;font-size:0.9rem">${article.description}</p>
        </a>
        <div style="margin-top:8px">
          ${article.tagList.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!user) { window.location.hash = '#/login'; return; }
        const slug = (btn as HTMLElement).dataset.slug!;
        const article = articles.find(a => a.slug === slug);
        if (!article) return;
        try {
          const res = article.favorited ? await api.unfavorite(slug) : await api.favorite(slug);
          articles = articles.map(a => a.slug === slug ? res.article : a);
          renderArticles();
        } catch (err) {
          console.error(err);
        }
      });
    });
  }
}
