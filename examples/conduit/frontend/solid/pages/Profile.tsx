import { createSignal, Show, For } from 'solid-js';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Profile as ProfileType, Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

interface Props {
  api: ConduitAPI;
  username: string;
  user: StoredUser | null;
}

export function Profile(props: Props) {
  const [profile, setProfile] = createSignal<ProfileType | null>(null);
  const [articles, setArticles] = createSignal<Article[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  (async () => {
    try {
      const [profileRes, articlesRes] = await Promise.all([
        props.api.getProfile(props.username),
        props.api.getArticles(),
      ]);
      setProfile(profileRes.profile);
      setArticles(articlesRes.articles.filter(a => a.author.username === props.username));
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  })();

  const isOwn = () => props.user?.username === props.username;

  async function toggleFollow() {
    const p = profile();
    if (!p || !props.user) return;
    try {
      const res = p.following
        ? await props.api.unfollow(props.username)
        : await props.api.follow(props.username);
      setProfile(res.profile);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function toggleFavorite(article: Article) {
    if (!props.user) { window.location.hash = '#/login'; return; }
    try {
      const res = article.favorited
        ? await props.api.unfavorite(article.slug)
        : await props.api.favorite(article.slug);
      setArticles(prev => prev.map(a => a.slug === article.slug ? res.article : a));
    } catch (err: any) {
      console.error(err);
    }
  }

  return (
    <Show when={!loading()} fallback={<div class="loading">Loading profile...</div>}>
      <Show when={profile()} fallback={<div class="loading">Profile not found</div>}>
        {(p) => (
          <div>
            <div class="profile-header">
              <img src={p().image || defaultImg} alt={p().username} />
              <h2>{p().username}</h2>
              <Show when={p().bio}>
                <p style="color: #999; margin: 8px 0">{p().bio}</p>
              </Show>
              <Show when={isOwn()} fallback={
                <Show when={props.user}>
                  <button class="btn" style="margin-top: 8px" onClick={toggleFollow}>
                    {p().following ? 'Unfollow' : 'Follow'} {p().username}
                  </button>
                </Show>
              }>
                <a href="#/settings" class="btn" style="margin-top: 8px">Edit Profile Settings</a>
              </Show>
            </div>

            {error() && <div class="error-msg">{error()}</div>}

            <h3 style="margin-bottom: 16px">Articles by {p().username}</h3>
            <Show when={articles().length > 0} fallback={<div class="loading">No articles yet.</div>}>
              <For each={articles()}>
                {(article) => (
                  <div class="card">
                    <div class="article-meta">
                      <img src={article.author.image || defaultImg} alt="" />
                      <div>
                        <a href={`#/profile/${article.author.username}`}>{article.author.username}</a>
                        <div>{new Date(article.createdAt).toLocaleDateString()}</div>
                      </div>
                      <button class="btn" style="margin-left: auto" onClick={() => toggleFavorite(article)}>
                        {article.favorited ? '\u2764' : '\u2661'} {article.favoritesCount}
                      </button>
                    </div>
                    <a href={`#/article/${article.slug}`}>
                      <h2 style="margin: 8px 0 4px; color: #333">{article.title}</h2>
                      <p style="color: #999; font-size: 0.9rem">{article.description}</p>
                    </a>
                    <div style="margin-top: 8px">
                      <For each={article.tagList}>
                        {(tag) => <span class="tag">{tag}</span>}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        )}
      </Show>
    </Show>
  );
}
