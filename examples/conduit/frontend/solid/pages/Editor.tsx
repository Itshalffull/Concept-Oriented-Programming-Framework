import { createSignal, For } from 'solid-js';
import type { ConduitAPI } from '../../shared/api-client.js';

interface Props {
  api: ConduitAPI;
  slug?: string;
}

export function Editor(props: Props) {
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [body, setBody] = createSignal('');
  const [tagInput, setTagInput] = createSignal('');
  const [tagList, setTagList] = createSignal<string[]>([]);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  function addTag(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = tagInput().trim();
      if (tag && !tagList().includes(tag)) {
        setTagList(prev => [...prev, tag]);
      }
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setTagList(prev => prev.filter(t => t !== tag));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await props.api.createArticle(title(), description(), body(), tagList());
      window.location.hash = `#/article/${res.article.slug}`;
    } catch (err: any) {
      setError(err.message || 'Failed to publish article');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style="max-width: 640px; margin: 0 auto">
      <h1 style="margin-bottom: 16px">{props.slug ? 'Edit Article' : 'New Article'}</h1>
      {error() && <div class="error-msg">{error()}</div>}
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <input type="text" placeholder="Article Title" value={title()} onInput={e => setTitle(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <input type="text" placeholder="What's this article about?" value={description()} onInput={e => setDescription(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <textarea placeholder="Write your article (in markdown)" value={body()} onInput={e => setBody(e.currentTarget.value)} style="min-height: 200px" required />
        </div>
        <div class="form-group">
          <input type="text" placeholder="Enter tags (press Enter to add)" value={tagInput()} onInput={e => setTagInput(e.currentTarget.value)} onKeyDown={addTag} />
          <div style="margin-top: 8px">
            <For each={tagList()}>
              {(tag) => <span class="tag" onClick={() => removeTag(tag)} style="cursor: pointer">&times; {tag}</span>}
            </For>
          </div>
        </div>
        <button class="btn btn-primary" type="submit" disabled={loading()} style="width: 100%">
          {loading() ? 'Publishing...' : 'Publish Article'}
        </button>
      </form>
    </div>
  );
}
