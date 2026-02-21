import { createSignal, Show, For } from 'solid-js';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article as ArticleType, Comment } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

interface Props {
  api: ConduitAPI;
  slug: string;
  user: StoredUser | null;
}

export function Article(props: Props) {
  const [article, setArticle] = createSignal<ArticleType | null>(null);
  const [comments, setComments] = createSignal<Comment[]>([]);
  const [commentBody, setCommentBody] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  (async () => {
    try {
      const [artRes, comRes] = await Promise.all([
        props.api.getArticles().then(r => r.articles.find(a => a.slug === props.slug)),
        props.api.getComments(props.slug),
      ]);
      if (artRes) setArticle(artRes);
      setComments(comRes.comments);
    } catch (err: any) {
      setError(err.message || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  })();

  async function submitComment(e: Event) {
    e.preventDefault();
    if (!commentBody().trim()) return;
    try {
      const res = await props.api.createComment(props.slug, commentBody());
      setComments(prev => [res.comment, ...prev]);
      setCommentBody('');
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    }
  }

  async function deleteComment(id: string) {
    try {
      await props.api.deleteComment(props.slug, id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment');
    }
  }

  async function deleteArticle() {
    try {
      await props.api.deleteArticle(props.slug);
      window.location.hash = '#/';
    } catch (err: any) {
      setError(err.message || 'Failed to delete article');
    }
  }

  async function toggleFavorite() {
    const art = article();
    if (!art || !props.user) return;
    try {
      const res = art.favorited
        ? await props.api.unfavorite(props.slug)
        : await props.api.favorite(props.slug);
      setArticle(res.article);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function toggleFollow() {
    const art = article();
    if (!art || !props.user) return;
    try {
      const res = art.author.following
        ? await props.api.unfollow(art.author.username)
        : await props.api.follow(art.author.username);
      setArticle(prev => prev ? { ...prev, author: res.profile } : prev);
    } catch (err: any) {
      console.error(err);
    }
  }

  const isAuthor = () => props.user?.username === article()?.author?.username;

  return (
    <Show when={!loading()} fallback={<div class="loading">Loading article...</div>}>
      <Show when={article()} fallback={<div class="loading">Article not found</div>}>
        {(art) => (
          <div>
            <div style="background: #333; color: #fff; padding: 32px 16px; margin: 0 -16px 24px">
              <h1 style="font-size: 2rem; margin-bottom: 12px">{art().title}</h1>
              <div class="article-meta">
                <img src={art().author.image || defaultImg} alt="" />
                <div>
                  <a href={`#/profile/${art().author.username}`} style="color: #fff">{art().author.username}</a>
                  <div style="color: #bbb">{new Date(art().createdAt).toLocaleDateString()}</div>
                </div>
                <Show when={isAuthor()} fallback={
                  <>
                    <button class="btn" style="border-color: #ccc; color: #ccc" onClick={toggleFollow}>
                      {art().author.following ? 'Unfollow' : 'Follow'} {art().author.username}
                    </button>
                    <button class="btn" onClick={toggleFavorite}>
                      {art().favorited ? '\u2764' : '\u2661'} {art().favoritesCount}
                    </button>
                  </>
                }>
                  <a href={`#/editor/${art().slug}`} class="btn" style="border-color: #ccc; color: #ccc">Edit</a>
                  <button class="btn btn-danger" onClick={deleteArticle}>Delete</button>
                </Show>
              </div>
            </div>

            {error() && <div class="error-msg">{error()}</div>}

            <div style="line-height: 1.8; margin-bottom: 32px; white-space: pre-wrap">{art().body}</div>

            <div style="margin-bottom: 16px">
              <For each={art().tagList}>
                {(tag) => <span class="tag">{tag}</span>}
              </For>
            </div>

            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0" />

            <div style="max-width: 640px; margin: 0 auto">
              <Show when={props.user} fallback={
                <p style="text-align: center; margin-bottom: 24px; color: #999">
                  <a href="#/login">Sign in</a> or <a href="#/register">sign up</a> to add comments.
                </p>
              }>
                <form onSubmit={submitComment} style="margin-bottom: 24px">
                  <textarea
                    placeholder="Write a comment..."
                    value={commentBody()}
                    onInput={e => setCommentBody(e.currentTarget.value)}
                    style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; min-height: 80px; margin-bottom: 8px"
                  />
                  <button class="btn btn-primary" type="submit">Post Comment</button>
                </form>
              </Show>

              <For each={comments()}>
                {(comment) => (
                  <div class="comment card">
                    <p style="margin-bottom: 8px">{comment.body}</p>
                    <div class="article-meta">
                      <img src={comment.author.image || defaultImg} alt="" />
                      <a href={`#/profile/${comment.author.username}`}>{comment.author.username}</a>
                      <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                      <Show when={props.user?.username === comment.author.username}>
                        <button class="btn btn-danger" style="margin-left: auto; padding: 2px 8px; font-size: 0.8rem" onClick={() => deleteComment(comment.id)}>
                          &times;
                        </button>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </Show>
    </Show>
  );
}
