import type { ConduitAPI } from '../../shared/api-client.js';

export function renderEditor(container: HTMLElement, api: ConduitAPI, slug?: string) {
  let tagList: string[] = [];

  container.innerHTML = `
    <div style="max-width:640px;margin:0 auto">
      <h1 style="margin-bottom:16px">${slug ? 'Edit Article' : 'New Article'}</h1>
      <div id="editor-error" class="error-msg" style="display:none"></div>
      <form id="editor-form">
        <div class="form-group"><input type="text" placeholder="Article Title" id="ed-title" required /></div>
        <div class="form-group"><input type="text" placeholder="What's this article about?" id="ed-desc" required /></div>
        <div class="form-group"><textarea placeholder="Write your article (in markdown)" id="ed-body" style="min-height:200px" required></textarea></div>
        <div class="form-group">
          <input type="text" placeholder="Enter tags (press Enter to add)" id="ed-tag-input" />
          <div id="ed-tags" style="margin-top:8px"></div>
        </div>
        <button class="btn btn-primary" type="submit" id="ed-btn" style="width:100%">Publish Article</button>
      </form>
    </div>
  `;

  const form = document.getElementById('editor-form') as HTMLFormElement;
  const errorEl = document.getElementById('editor-error')!;
  const btn = document.getElementById('ed-btn') as HTMLButtonElement;
  const tagInputEl = document.getElementById('ed-tag-input') as HTMLInputElement;
  const tagsEl = document.getElementById('ed-tags')!;

  function renderTags() {
    tagsEl.innerHTML = tagList.map(t => `<span class="tag" data-remove-tag="${t}" style="cursor:pointer">&times; ${t}</span>`).join('');
    tagsEl.querySelectorAll('[data-remove-tag]').forEach(el => {
      el.addEventListener('click', () => {
        const tag = (el as HTMLElement).dataset.removeTag!;
        tagList = tagList.filter(t => t !== tag);
        renderTags();
      });
    });
  }

  tagInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = tagInputEl.value.trim();
      if (tag && !tagList.includes(tag)) {
        tagList.push(tag);
        renderTags();
      }
      tagInputEl.value = '';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Publishing...';

    const title = (document.getElementById('ed-title') as HTMLInputElement).value;
    const description = (document.getElementById('ed-desc') as HTMLInputElement).value;
    const body = (document.getElementById('ed-body') as HTMLTextAreaElement).value;

    try {
      const res = await api.createArticle(title, description, body, tagList);
      window.location.hash = `#/article/${res.article.slug}`;
    } catch (err: any) {
      errorEl.textContent = err.message || 'Failed to publish article';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Publish Article';
    }
  });
}
