import { createSignal, createResource, For, Show } from 'solid-js';
import type { ConduitAPI } from '../../shared/api-client.js';
import type { Article } from '../../shared/types.js';
import type { StoredUser } from '../../shared/auth.js';

const defaultImg = 'https://api.realworld.io/images/smiley-cyrus.jpeg';

interface Props {
  api: ConduitAPI;
  user: StoredUser | null;
}

export function Home(props: Props) {
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);
  const [articles, setArticles] = createSignal<Article[]>([]);
  const [tags, setTags] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);

  (async () => {
    try {
      const [artRes, tagRes] = await Promise.all([
        props.api.getArticles(),
        props.api.getTags(),
      ]);
      setArticles(artRes.articles);
      setTags(tagRes.tags);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  })();

  const displayed = () => {
    const tag = selectedTag();
    return tag ? articles().filter(a => a.tagList.includes(tag)) : articles();
  };

  async function toggleFavorite(article: Article) {
    if (!props.user) { window.location.hash = '#/login'; return; }
    try {
      const res = article.favorited
        ? await props.api.unfavorite(article.slug)
        : await props.api.favorite(article.slug);
      setArticles(prev => prev.map(a => a.slug === article.slug ? res.article : a));
    } catch (err) {
      console.error('Favorite failed:', err);
    }
  }

  return (
    <>
      <div class="banner">
        <h1>conduit</h1>
        <p>A place to share your knowledge.</p>
      </div>
      <div class="two-col">
        <div>
          <Show when={selectedTag()}>
            {(tag) => (
              <div style="margin-bottom: 12px">
                Filtered by tag: <span class="tag">{tag()}</span>
                <button onClick={() => setSelectedTag(null)} style="margin-left: 8px; cursor: pointer; background: none; border: none; color: #999">
                  &times; clear
                </button>
              </div>
            )}
          </Show>
          <Show when={!loading()} fallback={<div class="loading">Loading articles...</div>}>
            <Show when={displayed().length > 0} fallback={<div class="loading">No articles yet.</div>}>
              <For each={displayed()}>
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
                        {(tag) => <span class="tag" onClick={() => setSelectedTag(tag)}>{tag}</span>}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>
        <div>
          <div class="card">
            <h4 style="margin-bottom: 8px">Popular Tags</h4>
            <Show when={tags().length > 0} fallback={<p style="color: #999">No tags yet</p>}>
              <For each={tags()}>
                {(tag) => <span class="tag" onClick={() => setSelectedTag(tag)}>{tag}</span>}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </>
  );
}
