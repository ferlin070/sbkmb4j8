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
  error: string | null;
}

const state: AppState = {
  candles: [],
  filter: { search: '', status: 'all' },
  sort: { key: 'updatedAt', direction: 'desc' },
  editingId: null,
  confirmingDeleteId: null,
  error: null,
};

const root = document.querySelector<HTMLDivElement>('#app');
let modalTrigger: HTMLElement | null = null;

const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
toastContainer.className = 'toast-container';
toastContainer.setAttribute('aria-live', 'polite');
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loading-overlay';
loadingOverlay.className = 'loading-overlay';
loadingOverlay.hidden = true;
loadingOverlay.innerHTML = '<div class="loading-overlay__spinner" aria-hidden="true"></div><p>Loading your collection…</p>';

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
  const toast = document.createElement('div');
  toast.className = 'toast toast--' + kind;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  toastContainer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function setLoading(loading: boolean): void {
  loadingOverlay.hidden = !loading;
}

function focusModal(): void {
  document.querySelector<HTMLElement>('#delete-confirm-cancel')?.focus();
}

function restoreFocus(): void {
  modalTrigger?.focus();
  modalTrigger = null;
}

function renderSummary(total: number, burning: number, finished: number, avg: number | null): string {
  const item = (v: string | number, cls: string, label: string) =>
    `<div class="summary__item"><span class="summary__value ${cls}">${v}</span><span class="summary__label">${label}</span></div>`;
  return `<div class="summary">
${item(total, '', 'Total logged')}
${item(burning, 'summary__value--burning', 'Burning')}
${item(finished, 'summary__value--finished', 'Finished')}
${item(avg === null ? '—' : avg + '★', '', 'Avg rating')}
</div>`;
}

function renderCard(candle: Candle): string {
  const f = escapeHtml;
  const notes = candle.notes ? `<p class="card__notes">${f(candle.notes)}</p>` : '';
  const scent = candle.scentNotes ? `<p class="card__scent">${f(candle.scentNotes)}</p>` : '';
  return `<article class="card status-card--${candle.status}" data-id="${candle.id}">
<div class="card__header"><span class="status status--${candle.status}">${STATUS_LABELS[candle.status]}</span><span class="card__brand">${f(candle.brand)}</span></div>
<h3 class="card__name">${f(candle.name)}</h3>
${scent}${ratingStars(candle.rating)}${notes}
<div class="card__footer"><span class="card__date">Updated ${formatDate(candle.updatedAt)}</span>
<div class="card__actions"><button class="btn btn--ghost" data-action="edit" data-id="${candle.id}">Edit</button><button class="btn btn--ghost btn--danger" data-action="delete" data-id="${candle.id}">Delete</button></div></div></article>`;
}

function renderGrid(candles: Candle[]): string {
  if (candles.length === 0) {
    return `<div class="empty"><h3>No candles here</h3><p>Adjust filters or add an entry.</p></div>`
  }
  return `<div class="grid">${candles.map(renderCard).join('')}</div>`;
}

function renderForm(candle: Candle | null): string {
  const isEdit = candle !== null;
  const c = candle;
  const v = (f: 'name' | 'brand' | 'scentNotes' | 'notes'): string => (c ? escapeHtml(c[f]) : '');
  const sel = (s: Candle['status']) => c && c.status === s ? 'selected' : '';
  const chk = (r: number) => c && c.rating === r ? 'checked' : '';
  return `<form id="candle-form" class="form" novalidate>
<h2 class="form__title">${isEdit ? 'Edit candle' : 'Add a candle'}</h2>
<div class="form__row">
<div class="field"><label for="f-name">Name</label><input id="f-name" name="name" type="text" maxlength="120" required placeholder="Midnight Ember" value="${v('name')}" /></div>
<div class="field"><label for="f-brand">Brand</label><input id="f-brand" name="brand" type="text" maxlength="120" required placeholder="Boy Smells" value="${v('brand')}" /></div>
</div>
<div class="field"><label for="f-scent">Scent notes</label><input id="f-scent" name="scentNotes" type="text" maxlength="300" placeholder="cedarwood, vanilla, sea salt" value="${v('scentNotes')}" /></div>
<div class="form__row">
<div class="field"><label for="f-status">Status</label><select id="f-status" name="status">${CANDLE_STATUSES.map((s) => `<option value="${s}" ${sel(s)}>${STATUS_LABELS[s]}</option>`).join('')}</select></div>
<div class="field"><label>Rating</label><div class="rating-input" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((r) => `<label class="rating-input__label"><input type="radio" name="rating" value="${r}" aria-label="${r} star${r > 1 ? 's' : ''}" ${chk(r)} /><span aria-hidden="true">★</span></label>`).join('')}</div></div>
</div>
<div class="field"><label for="f-notes">Personal notes</label><textarea id="f-notes" name="notes" maxlength="1000" rows="3" placeholder="tunneled badly, perfect for evenings">${v('notes')}</textarea></div>
<div class="form__actions"><button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add to collection'}</button>${isEdit ? '<button type="button" class="btn btn--ghost" data-action="cancel-edit">Cancel</button>' : ''}</div>
</form>`;
}

function render(): void {
  if (!root) return;
  const stats = computeStats(state.candles);
  const visible = viewCandles(state.candles, state.filter, state.sort);
  const editing = state.editingId ? (state.candles.find((c) => c.id === state.editingId) ?? null) : null;
  const modal = state.confirmingDeleteId
    ? `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title"><div class="modal"><h2 id="delete-confirm-title">Remove candle?</h2><p>Permanently delete from your collection. Can't be undone.</p><div class="modal__actions"><button id="delete-confirm-cancel" type="button" class="btn btn--ghost">Cancel</button><button id="delete-confirm-confirm" type="button" class="btn btn--danger">Remove</button></div></div></div>`
    : '';

  root.innerHTML = `<div class="app">
<header class="masthead" aria-label="Page header">
<div class="masthead__glow" aria-hidden="true"></div>
<h1 class="masthead__title">Candle Collection Log</h1>
<p class="masthead__subtitle">Catalog every candle you own or have burned through.</p>
</header>
${renderSummary(stats.total, stats.burning, stats.finished, stats.averageRating)}
${state.error ? `<div class="error-banner" role="alert"><span>${escapeHtml(state.error)}</span><button class="error-banner__close" data-action="dismiss-error" type="button" aria-label="Dismiss error">×</button></div>` : ''}
<section class="controls" aria-label="Filter and sort">
<div class="controls__search"><input id="search" type="search" placeholder="Search name, brand, scent, notes…" value="${escapeHtml(state.filter.search)}" /></div>
<div class="controls__filters">
${FILTER_STATUSES.map((s) => `<label class="chip ${state.filter.status === s ? 'chip--active' : ''}"><input type="radio" name="status-filter" value="${s}" ${state.filter.status === s ? 'checked' : ''} />${STATUS_FILTER_LABELS[s]}</label>`).join('')}
</div>
<div class="controls__sort">
<label for="sort-select">Sort by</label>
<select id="sort-select">${SORT_OPTIONS.map(([key, direction, label]) => `<option value="${key}-${direction}" ${state.sort.key === key && state.sort.direction === direction ? 'selected' : ''}>${label}</option>`).join('')}</select>
</div>
</section>
<main class="content" aria-label="Candle collection">
<section class="form-panel" aria-label="${editing ? 'Edit candle' : 'Add candle'}">${renderForm(editing)}</section>
<section class="collection-panel" aria-label="Candles list">
<div class="collection-panel__head"><h2>Your collection</h2><span class="collection-panel__count">${visible.length} shown</span></div>
${renderGrid(visible)}
</section>
</main>
</div>
${modal}`;
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
    if (!result.ok) state.error = result.error ?? 'Could not save.';
    render();
  }, 0);
}

function handleAction(target: HTMLElement): void {
  const { action, id } = target.dataset;
  if (!action) return;
  if (action === 'cancel-edit') {
    state.editingId = null;
    render();
    return;
  }
  if (action === 'dismiss-error') {
    state.error = null;
    render();
    return;
  }
  if (!id) return;
  if (action === 'edit') {
    state.editingId = id;
    render();
    document.querySelector<HTMLFormElement>('#candle-form')?.scrollIntoView?.({ behavior: 'smooth' });
  } else if (action === 'delete') {
    modalTrigger = target;
    state.confirmingDeleteId = id;
    render();
    focusModal();
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
  restoreFocus();
}

function handleDeleteCancel(): void {
  state.confirmingDeleteId = null;
  render();
  restoreFocus();
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
  document.body.append(toastContainer, loadingOverlay);
  setLoading(true);
  render();
  window.setTimeout(() => {
    const result = loadCandles();
    if (result.error && !result.ok) state.error = result.error;
    else if (result.error) showToast(result.error, 'info');
    state.candles = result.candles;
    setLoading(false);
    bindEvents();
    render();
  }, 250);
}

boot();
