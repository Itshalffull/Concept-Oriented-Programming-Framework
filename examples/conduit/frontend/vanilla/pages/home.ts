import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

export async function renderHome(container: HTMLElement, api: ConduitAPI, user: StoredUser | null) {
  container.innerHTML = `
    <div class="banner"><h1>conduit</h1><p>A place to share your knowledge.</p></div>
    <div class="two-col">
      <div id="feed"><div class="loading">Loading articles...</div></div>
      <div><div class="card"><h4 style="margin-bottom:8px">Popular Tags</h4><div id="tags-list"><p style="color:#999">Loading...</p></div></div></div>
    </div>
  `;

  const feedEl = document.getElementById('feed')!;
  const tagsEl = document.getElementById('tags-list')!;
  let articles: Article[] = [];
  let selectedTag: string | null = null;

  try {
    const [artRes, tagRes] = await Promise.all([api.getArticles(), api.getTags()]);
    articles = artRes.articles;

    // Render tags
    if (tagRes.tags.length === 0) {
      tagsEl.innerHTML = '<p style="color:#999">No tags yet</p>';
    } else {
      tagsEl.innerHTML = tagRes.tags.map(t => `<span class="tag" data-tag="${t}">${t}</span>`).join('');
      tagsEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.dataset.tag) {
          selectedTag = target.dataset.tag;
          renderFeed();
        }
      });
    }

    renderFeed();
  } catch (err) {
    feedEl.innerHTML = `<div class="error-msg">Failed to load feed</div>`;
  }

  function renderFeed() {
    const displayed = selectedTag ? articles.filter(a => a.tagList.includes(selectedTag!)) : articles;

    let html = '';
    if (selectedTag) {
      html += `<div style="margin-bottom:12px">Filtered by tag: <span class="tag">${selectedTag}</span> <button id="clear-tag" style="margin-left:8px;cursor:pointer;background:none;border:none;color:#999">&times; clear</button></div>`;
    }

    if (displayed.length === 0) {
      html += '<div class="loading">No articles yet.</div>';
    } else {
      for (const article of displayed) {
        html += `
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
              ${article.tagList.map(t => `<span class="tag" data-feed-tag="${t}">${t}</span>`).join('')}
            </div>
          </div>
        `;
      }
    }

    feedEl.innerHTML = html;

    // Attach clear tag handler
    const clearBtn = document.getElementById('clear-tag');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => { selectedTag = null; renderFeed(); });
    }

    // Attach favorite handlers
    feedEl.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!user) { window.location.hash = '#/login'; return; }
        const slug = (btn as HTMLElement).dataset.slug!;
        const article = articles.find(a => a.slug === slug);
        if (!article) return;
        try {
          const res = article.favorited ? await api.unfavorite(slug) : await api.favorite(slug);
          articles = articles.map(a => a.slug === slug ? res.article : a);
          renderFeed();
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Attach tag click handlers in feed
    feedEl.querySelectorAll('[data-feed-tag]').forEach(el => {
      el.addEventListener('click', () => {
        selectedTag = (el as HTMLElement).dataset.feedTag!;
        renderFeed();
      });
    });
  }
}
