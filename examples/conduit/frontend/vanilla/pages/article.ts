import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article, Comment } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

export async function renderArticle(container: HTMLElement, api: ConduitAPI, slug: string, user: StoredUser | null) {
  container.innerHTML = '<div class="loading">Loading article...</div>';

  let article: Article | undefined;
  let comments: Comment[] = [];

  try {
    const [artRes, comRes] = await Promise.all([
      api.getArticles().then(r => r.articles.find(a => a.slug === slug)),
      api.getComments(slug),
    ]);
    article = artRes;
    comments = comRes.comments;
  } catch (err: any) {
    container.innerHTML = `<div class="error-msg">${err.message || 'Failed to load article'}</div>`;
    return;
  }

  if (!article) {
    container.innerHTML = '<div class="loading">Article not found</div>';
    return;
  }

  render();

  function render() {
    if (!article) return;
    const isAuthor = user?.username === article.author.username;

    container.innerHTML = `
      <div style="background:#333;color:#fff;padding:32px 16px;margin:0 -16px 24px">
        <h1 style="font-size:2rem;margin-bottom:12px">${article.title}</h1>
        <div class="article-meta">
          <img src="${article.author.image || defaultImg}" alt="" />
          <div>
            <a href="#/profile/${article.author.username}" style="color:#fff">${article.author.username}</a>
            <div style="color:#bbb">${new Date(article.createdAt).toLocaleDateString()}</div>
          </div>
          ${isAuthor ? `
            <a href="#/editor/${article.slug}" class="btn" style="border-color:#ccc;color:#ccc">Edit</a>
            <button class="btn btn-danger" id="delete-article">Delete</button>
          ` : `
            <button class="btn" style="border-color:#ccc;color:#ccc" id="toggle-follow">
              ${article.author.following ? 'Unfollow' : 'Follow'} ${article.author.username}
            </button>
            <button class="btn" id="toggle-fav">
              ${article.favorited ? '\u2764' : '\u2661'} ${article.favoritesCount}
            </button>
          `}
        </div>
      </div>
      <div style="line-height:1.8;margin-bottom:32px;white-space:pre-wrap">${article.body}</div>
      <div style="margin-bottom:16px">${article.tagList.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e0e0e0" />
      <div style="max-width:640px;margin:0 auto">
        ${user ? `
          <form id="comment-form" style="margin-bottom:24px">
            <textarea id="comment-body" placeholder="Write a comment..." style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;min-height:80px;margin-bottom:8px"></textarea>
            <button class="btn btn-primary" type="submit">Post Comment</button>
          </form>
        ` : `
          <p style="text-align:center;margin-bottom:24px;color:#999">
            <a href="#/login">Sign in</a> or <a href="#/register">sign up</a> to add comments.
          </p>
        `}
        <div id="comments-list"></div>
      </div>
    `;

    renderComments();
    attachHandlers();
  }

  function renderComments() {
    const list = document.getElementById('comments-list')!;
    list.innerHTML = comments.map(c => `
      <div class="card" style="margin-bottom:12px">
        <p style="margin-bottom:8px">${c.body}</p>
        <div class="article-meta">
          <img src="${c.author.image || defaultImg}" alt="" />
          <a href="#/profile/${c.author.username}">${c.author.username}</a>
          <span>${new Date(c.createdAt).toLocaleDateString()}</span>
          ${user?.username === c.author.username ? `<button class="btn btn-danger del-comment" data-id="${c.id}" style="margin-left:auto;padding:2px 8px;font-size:0.8rem">&times;</button>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.del-comment').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!;
        try {
          await api.deleteComment(slug, id);
          comments = comments.filter(c => c.id !== id);
          renderComments();
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  function attachHandlers() {
    const deleteBtn = document.getElementById('delete-article');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        try {
          await api.deleteArticle(slug);
          window.location.hash = '#/';
        } catch (err) {
          console.error(err);
        }
      });
    }

    const followBtn = document.getElementById('toggle-follow');
    if (followBtn && article) {
      followBtn.addEventListener('click', async () => {
        if (!article || !user) return;
        try {
          const res = article.author.following
            ? await api.unfollow(article.author.username)
            : await api.follow(article.author.username);
          article = { ...article!, author: res.profile };
          render();
        } catch (err) {
          console.error(err);
        }
      });
    }

    const favBtn = document.getElementById('toggle-fav');
    if (favBtn && article) {
      favBtn.addEventListener('click', async () => {
        if (!article || !user) return;
        try {
          const res = article.favorited
            ? await api.unfavorite(slug)
            : await api.favorite(slug);
          article = res.article;
          render();
        } catch (err) {
          console.error(err);
        }
      });
    }

    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = (document.getElementById('comment-body') as HTMLTextAreaElement).value.trim();
        if (!body) return;
        try {
          const res = await api.createComment(slug, body);
          comments = [res.comment, ...comments];
          (document.getElementById('comment-body') as HTMLTextAreaElement).value = '';
          renderComments();
        } catch (err) {
          console.error(err);
        }
      });
    }
  }
}
