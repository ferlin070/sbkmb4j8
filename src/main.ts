import './style.css';
import { computeStats, viewCandles } from './domain';
import { escapeHtml, formatDate, ratingStars } from './render';
import {
  CANDLE_STATUSES,
  STATUS_LABELS,
  createCandleFromDraft,
  updateCandleFromDraft,
  ValidationError,
} from './schema';
import { loadCandles, saveCandles } from './storage';
import type {
  Candle,
  CandleDraft,
  CandleStatus,
  FilterState,
  SortKey,
  SortState,
} from './types';

interface AppState {
  candles: Candle[];
  filter: FilterState;
  sort: SortState;
  editingId: string | null;
  confirmingDeleteId: string | null;
}

const state: AppState = {
  candles: [],
  filter: { search: '', status: 'all' },
  sort: { key: 'updatedAt', direction: 'desc' },
  editingId: null,
  confirmingDeleteId: null,
};

const root = document.querySelector<HTMLDivElement>('#app');

const SORT_OPTIONS: [SortKey, SortState['direction'], string][] = [
  ['updatedAt', 'desc', 'Recently updated'],
  ['name', 'asc', 'Name A–Z'],
  ['brand', 'asc', 'Brand A–Z'],
  ['rating', 'desc', 'Highest rated'],
  ['createdAt', 'desc', 'Newest added'],
];

const FILTER_STATUSES = ['all', ...CANDLE_STATUSES] as const;
const STATUS_FILTER_LABELS: Record<string, string> = { all: 'All', ...STATUS_LABELS };

function showToast(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  const container = document.querySelector<HTMLDivElement>('#toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast--' + kind;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function setLoading(loading: boolean): void {
  const overlay = document.querySelector<HTMLDivElement>('#loading-overlay');
  if (overlay) overlay.hidden = !loading;
}

function statusClass(status: CandleStatus): string {
  return 'status status--' + status;
}

function renderSummary(total: number, burning: number, finished: number): string {
  return `<div class="summary">
<div class="summary__item"><span class="summary__value">${total}</span><span class="summary__label">Total logged</span></div>
<div class="summary__item"><span class="summary__value summary__value--burning">${burning}</span><span class="summary__label">Burning</span></div>
<div class="summary__item"><span class="summary__value summary__value--finished">${finished}</span><span class="summary__label">Finished</span></div>
</div>`;
}

function renderCard(candle: Candle): string {
  const f = escapeHtml;
  const notes = candle.notes ? `<p class="card__notes">${f(candle.notes)}</p>` : '';
  const scent = candle.scentNotes ? `<p class="card__scent">${f(candle.scentNotes)}</p>` : '';
  return `<article class="card status-card--${candle.status}" data-id="${candle.id}">
<div class="card__header"><span class="${statusClass(candle.status)}">${STATUS_LABELS[candle.status]}</span><span class="card__brand">${f(candle.brand)}</span></div>
<h3 class="card__name">${f(candle.name)}</h3>
${scent}${ratingStars(candle.rating)}${notes}
<div class="card__footer"><span class="card__date">Updated ${formatDate(candle.updatedAt)}</span>
<div class="card__actions">
<button class="btn btn--ghost" data-action="edit" data-id="${candle.id}">Edit</button>
<button class="btn btn--ghost btn--danger" data-action="delete" data-id="${candle.id}">Delete</button>
</div></div></article>`;
}

function renderGrid(candles: Candle[]): string {
  if (candles.length === 0) {
    return `<div class="empty"><div class="empty__flame" aria-hidden="true">🕯️</div><h3>No candles here</h3><p>Adjust your filters, or add a new entry.</p></div>`;
  }
  return `<div class="grid">${candles.map(renderCard).join('')}</div>`;
}

function renderForm(candle: Candle | null): string {
  const isEdit = candle !== null;
  const c = candle;
  const val = (f: 'name' | 'brand' | 'scentNotes' | 'notes'): string => (c ? escapeHtml(c[f]) : '');
  return `<form id="candle-form" class="form" novalidate>
<h2 class="form__title">${isEdit ? 'Edit candle' : 'Add a candle'}</h2>
<div class="form__row">
<div class="field"><label for="f-name">Name</label><input id="f-name" name="name" type="text" maxlength="120" required placeholder="e.g. Midnight Ember" value="${val('name')}" /></div>
<div class="field"><label for="f-brand">Brand</label><input id="f-brand" name="brand" type="text" maxlength="120" required placeholder="e.g. Boy Smells" value="${val('brand')}" /></div>
</div>
<div class="field"><label for="f-scent">Scent notes</label><input id="f-scent" name="scentNotes" type="text" maxlength="300" placeholder="cedarwood, vanilla, sea salt" value="${val('scentNotes')}" /></div>
<div class="form__row">
<div class="field"><label for="f-status">Status</label><select id="f-status" name="status">${CANDLE_STATUSES.map((s) => `<option value="${s}" ${c && c.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}</select></div>
<div class="field"><label>Rating</label><div class="rating-input" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((r) => `<label class="rating-input__label"><input type="radio" name="rating" value="${r}" ${c && c.rating === r ? 'checked' : ''} /><span aria-hidden="true">★</span></label>`).join('')}</div></div>
</div>
<div class="field"><label for="f-notes">Personal notes</label><textarea id="f-notes" name="notes" maxlength="1000" rows="3" placeholder="tunneled badly, perfect for evenings">${val('notes')}</textarea></div>
<div class="form__actions"><button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add to collection'}</button>${isEdit ? '<button type="button" class="btn btn--ghost" data-action="cancel-edit">Cancel</button>' : ''}</div>
</form>`;
}

function render(): void {
  if (!root) return;
  const stats = computeStats(state.candles);
  const visible = viewCandles(state.candles, state.filter, state.sort);
  const editing = state.editingId ? (state.candles.find((c) => c.id === state.editingId) ?? null) : null;
  const modal = state.confirmingDeleteId
    ? `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title"><div class="modal"><h2 id="delete-confirm-title">Remove this candle?</h2><p>This will permanently delete it from your collection. This can't be undone.</p><div class="modal__actions"><button id="delete-confirm-cancel" type="button" class="btn btn--ghost">Cancel</button><button id="delete-confirm-confirm" type="button" class="btn btn--danger">Remove</button></div></div></div>`
    : '';

  root.innerHTML = `<div class="app">
<header class="masthead">
<div class="masthead__glow" aria-hidden="true"></div>
<h1 class="masthead__title">🕯️ Candle Collection Log</h1>
<p class="masthead__subtitle">Catalog every candle you own or have burned through.</p>
</header>
${renderSummary(stats.total, stats.burning, stats.finished)}
<section class="controls">
<div class="controls__search"><input id="search" type="search" placeholder="Search name, brand, scent, notes…" value="${escapeHtml(state.filter.search)}" aria-label="Search candles" /></div>
<div class="controls__filters">
${FILTER_STATUSES.map((s) => `<label class="chip ${state.filter.status === s ? 'chip--active' : ''}"><input type="radio" name="status-filter" value="${s}" ${state.filter.status === s ? 'checked' : ''} />${STATUS_FILTER_LABELS[s]}</label>`).join('')}
</div>
<div class="controls__sort">
<label for="sort-select">Sort by</label>
<select id="sort-select">${SORT_OPTIONS.map(([key, direction, label]) => `<option value="${key}-${direction}" ${state.sort.key === key && state.sort.direction === direction ? 'selected' : ''}>${label}</option>`).join('')}</select>
</div>
</section>
<main class="content">
<section class="form-panel">${renderForm(editing)}</section>
<section class="collection-panel">
<div class="collection-panel__head"><h2>Your collection</h2><span class="collection-panel__count">${visible.length} shown</span></div>
${renderGrid(visible)}
</section>
</main>
</div>
${modal}
<div id="toast-container" class="toast-container" aria-live="polite"></div>
<div id="loading-overlay" class="loading-overlay" hidden><div class="loading-overlay__spinner" aria-hidden="true"></div><p>Loading your collection…</p></div>`;
}

function readDraft(form: HTMLFormElement): CandleDraft | null {
  const el = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  const name = el('name')?.value ?? '';
  const brand = el('brand')?.value ?? '';
  const scentNotes = el('scentNotes')?.value ?? '';
  const status = el('status')?.value as CandleStatus;
  const notes = el('notes')?.value ?? '';
  const ratingInput = form.elements.namedItem('rating') as RadioNodeList | null;
  const rating = ratingInput?.value ? Number(ratingInput.value) : null;
  if (!name || !brand || !rating) return null;
  return { name, brand, scentNotes, status, rating: rating as CandleDraft['rating'], notes };
}

function handleSubmit(event: SubmitEvent): void {
  event.preventDefault();
  const draft = readDraft(event.target as HTMLFormElement);
  if (!draft) {
    showToast('Please fill in a name, brand, and rating.', 'error');
    return;
  }
  try {
    if (state.editingId) {
      const existing = state.candles.find((c) => c.id === state.editingId);
      if (!existing) return;
      const updated = updateCandleFromDraft(existing, draft);
      state.candles = state.candles.map((c) => (c.id === updated.id ? updated : c));
      showToast('Candle updated.', 'success');
    } else {
      state.candles = [createCandleFromDraft(draft), ...state.candles];
      showToast('Candle added to your collection.', 'success');
    }
    state.editingId = null;
    persist();
  } catch (err) {
    showToast(
      err instanceof ValidationError
        ? 'Check the highlighted fields: ' + err.fields.join(', ') + '.'
        : 'Something went wrong while saving.',
      'error',
    );
  }
}

function persist(): void {
  setLoading(true);
  window.setTimeout(() => {
    const result = saveCandles(state.candles);
    setLoading(false);
    if (!result.ok) showToast(result.error ?? 'Could not save.', 'error');
    render();
  }, 0);
}

function handleAction(target: HTMLElement): void {
  const { action, id } = target.dataset;
  if (!action || !id) return;
  if (action === 'edit') {
    state.editingId = id;
    render();
    document.querySelector<HTMLFormElement>('#candle-form')?.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'delete') {
    state.confirmingDeleteId = id;
    render();
  }
}

function handleDeleteConfirm(): void {
  const id = state.confirmingDeleteId;
  if (!id) return;
  state.candles = state.candles.filter((c) => c.id !== id);
  state.confirmingDeleteId = null;
  if (state.editingId === id) state.editingId = null;
  persist();
  showToast('Candle removed.', 'success');
}

function handleDeleteCancel(): void {
  state.confirmingDeleteId = null;
  render();
}

function bindEvents(): void {
  document.addEventListener('submit', (event) => {
    if ((event.target as HTMLElement).id === 'candle-form') handleSubmit(event);
  });
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('#delete-confirm-confirm')) return handleDeleteConfirm();
    if (target.closest('#delete-confirm-cancel')) return handleDeleteCancel();
    const actionTarget = target.closest<HTMLElement>('[data-action]');
    if (actionTarget) handleAction(actionTarget);
  });
  document.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'search') {
      state.filter.search = (target as HTMLInputElement).value;
      render();
    }
  });
  document.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.name === 'status-filter') {
      state.filter.status = target.value as FilterState['status'];
      render();
    } else if (target.id === 'sort-select') {
      const [key, direction] = (target as HTMLSelectElement).value.split('-');
      state.sort = { key: key as SortKey, direction: direction as SortState['direction'] };
      render();
    }
  });
}

function boot(): void {
  if (!root) return;
  setLoading(true);
  render();
  window.setTimeout(() => {
    const result = loadCandles();
    if (result.error) showToast(result.error, result.ok ? 'info' : 'error');
    state.candles = result.candles;
    setLoading(false);
    bindEvents();
    render();
  }, 250);
}

boot();
