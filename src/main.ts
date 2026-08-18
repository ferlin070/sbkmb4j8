/**
 * Main application entry point. Wires storage + domain logic to the DOM.
 * Owns application state and the render pipeline; delegates persistence to
 * the storage module and pure logic to the domain module.
 */

import './style.css';

import {
  computeStats,
  viewCandles,
} from './domain';
import { escapeHtml, formatDate, ratingStars } from './render';
import {
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
import { CANDLE_STATUSES, STATUS_LABELS } from './schema';

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

interface AppState {
  candles: Candle[];
  filter: FilterState;
  sort: SortState;
  /** Id of the candle currently being edited, or null when the form is in "add" mode. */
  editingId: string | null;
  /** Id of the candle whose delete confirmation is open. */
  confirmingDeleteId: string | null;
}

const state: AppState = {
  candles: [],
  filter: { search: '', status: 'all' },
  sort: { key: 'updatedAt', direction: 'desc' },
  editingId: null,
  confirmingDeleteId: null,
};

// ---------------------------------------------------------------------------
// DOM references (resolved once after the app root is built)
// ---------------------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>('#app');

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

function showToast(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
  const container = document.querySelector<HTMLDivElement>('#toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast--' + kind;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);

  // Auto-dismiss after a few seconds.
  window.setTimeout(() => {
    toast.classList.add('toast--leaving');
    window.setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function setLoading(loading: boolean): void {
  const overlay = document.querySelector<HTMLDivElement>('#loading-overlay');
  if (overlay) overlay.hidden = !loading;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function statusClass(status: CandleStatus): string {
  return 'status status--' + status;
}

function renderSummary(total: number, burning: number, finished: number): string {
  return `
    <div class="summary">
      <div class="summary__item">
        <span class="summary__value">${total}</span>
        <span class="summary__label">Total logged</span>
      </div>
      <div class="summary__item">
        <span class="summary__value summary__value--burning">${burning}</span>
        <span class="summary__label">Burning</span>
      </div>
      <div class="summary__item">
        <span class="summary__value summary__value--finished">${finished}</span>
        <span class="summary__label">Finished</span>
      </div>
    </div>
  `;
}

function renderCard(candle: Candle): string {
  const notes = candle.notes
    ? `<p class="card__notes">${escapeHtml(candle.notes)}</p>`
    : '';
  const scent = candle.scentNotes
    ? `<p class="card__scent">${escapeHtml(candle.scentNotes)}</p>`
    : '';

  return `
    <article class="card status-card status-card--${candle.status}" data-id="${candle.id}">
      <div class="card__header">
        <span class="${statusClass(candle.status)}">${STATUS_LABELS[candle.status]}</span>
        <span class="card__brand">${escapeHtml(candle.brand)}</span>
      </div>
      <h3 class="card__name">${escapeHtml(candle.name)}</h3>
      ${scent}
      ${ratingStars(candle.rating)}
      ${notes}
      <div class="card__footer">
        <span class="card__date">Updated ${formatDate(candle.updatedAt)}</span>
        <div class="card__actions">
          <button class="btn btn--ghost" data-action="edit" data-id="${candle.id}" type="button">Edit</button>
          <button class="btn btn--ghost btn--danger" data-action="delete" data-id="${candle.id}" type="button">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderGrid(candles: Candle[]): string {
  if (candles.length === 0) {
    return `
      <div class="empty">
        <div class="empty__flame" aria-hidden="true">🕯️</div>
        <h3>No candles here</h3>
        <p>Try adjusting your filters, or light up the log with a new entry.</p>
      </div>
    `;
  }
  return `<div class="grid">${candles.map(renderCard).join('')}</div>`;
}

function renderForm(candle: Candle | null): string {
  const isEdit = candle !== null;
  const c = candle ?? null;

  return `
    <form id="candle-form" class="form" novalidate>
      <h2 class="form__title">${isEdit ? 'Edit candle' : 'Add a candle'}</h2>

      <div class="form__row">
        <div class="field">
          <label for="f-name">Name</label>
          <input id="f-name" name="name" type="text" maxlength="120" required
            placeholder="e.g. Midnight Ember" value="${c ? escapeHtml(c.name) : ''}" />
        </div>
        <div class="field">
          <label for="f-brand">Brand</label>
          <input id="f-brand" name="brand" type="text" maxlength="120" required
            placeholder="e.g. Boy Smells" value="${c ? escapeHtml(c.brand) : ''}" />
        </div>
      </div>

      <div class="field">
        <label for="f-scent">Scent notes</label>
        <input id="f-scent" name="scentNotes" type="text" maxlength="300"
          placeholder="e.g. cedarwood, vanilla, sea salt" value="${c ? escapeHtml(c.scentNotes) : ''}" />
      </div>

      <div class="form__row">
        <div class="field">
          <label for="f-status">Status</label>
          <select id="f-status" name="status">
            ${CANDLE_STATUSES.map(
              (s) =>
                `<option value="${s}" ${c && c.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`,
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label>Rating</label>
          <div class="rating-input" role="radiogroup" aria-label="Rating">
            ${[1, 2, 3, 4, 5]
              .map((r) => {
                const checked = c && c.rating === r;
                return `
                  <label class="rating-input__label">
                    <input type="radio" name="rating" value="${r}" ${checked ? 'checked' : ''} />
                    <span aria-hidden="true">★</span>
                  </label>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <div class="field">
        <label for="f-notes">Personal notes</label>
        <textarea id="f-notes" name="notes" maxlength="1000" rows="3"
          placeholder="e.g. tunneled badly, perfect for evenings">${c ? escapeHtml(c.notes) : ''}</textarea>
      </div>

      <div class="form__actions">
        <button type="submit" class="btn btn--primary">${isEdit ? 'Save changes' : 'Add to collection'}</button>
        ${isEdit ? '<button type="button" class="btn btn--ghost" data-action="cancel-edit">Cancel</button>' : ''}
      </div>
    </form>
  `;
}

function render(): void {
  if (!root) return;

  const stats = computeStats(state.candles);
  const visible = viewCandles(state.candles, state.filter, state.sort);
  const editing = state.editingId
    ? (state.candles.find((c) => c.id === state.editingId) ?? null)
    : null;

  root.innerHTML = `
    <div class="app">
      <header class="masthead">
        <div class="masthead__glow" aria-hidden="true"></div>
        <h1 class="masthead__title">🕯️ Candle Collection Log</h1>
        <p class="masthead__subtitle">Catalog every candle you own or have burned through.</p>
      </header>

      ${renderSummary(stats.total, stats.burning, stats.finished)}

      <section class="controls">
        <div class="controls__search">
          <input id="search" type="search" placeholder="Search name, brand, scent, notes…"
            value="${escapeHtml(state.filter.search)}" aria-label="Search candles" />
        </div>
        <div class="controls__filters">
          <label class="chip ${state.filter.status === 'all' ? 'chip--active' : ''}">
            <input type="radio" name="status-filter" value="all" ${state.filter.status === 'all' ? 'checked' : ''} />
            All
          </label>
          ${CANDLE_STATUSES.map(
            (s) => `
              <label class="chip ${state.filter.status === s ? 'chip--active' : ''}">
                <input type="radio" name="status-filter" value="${s}" ${state.filter.status === s ? 'checked' : ''} />
                ${STATUS_LABELS[s]}
              </label>
            `,
          ).join('')}
        </div>
        <div class="controls__sort">
          <label for="sort-select">Sort by</label>
          <select id="sort-select">
            <option value="updatedAt-desc" ${state.sort.key === 'updatedAt' && state.sort.direction === 'desc' ? 'selected' : ''}>Recently updated</option>
            <option value="name-asc" ${state.sort.key === 'name' && state.sort.direction === 'asc' ? 'selected' : ''}>Name A–Z</option>
            <option value="brand-asc" ${state.sort.key === 'brand' && state.sort.direction === 'asc' ? 'selected' : ''}>Brand A–Z</option>
            <option value="rating-desc" ${state.sort.key === 'rating' && state.sort.direction === 'desc' ? 'selected' : ''}>Highest rated</option>
            <option value="createdAt-desc" ${state.sort.key === 'createdAt' && state.sort.direction === 'desc' ? 'selected' : ''}>Newest added</option>
          </select>
        </div>
      </section>

      <main class="content">
        <section class="form-panel">
          ${renderForm(editing)}
        </section>
        <section class="collection-panel">
          <div class="collection-panel__head">
            <h2>Your collection</h2>
            <span class="collection-panel__count">${visible.length} shown</span>
          </div>
          ${renderGrid(visible)}
        </section>
      </main>
    </div>

    ${
      state.confirmingDeleteId
        ? `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
            <div class="modal">
              <h2 id="delete-confirm-title">Remove this candle?</h2>
              <p>This will permanently delete it from your collection. This can’t be undone.</p>
              <div class="modal__actions">
                <button id="delete-confirm-cancel" type="button" class="btn btn--ghost">Cancel</button>
                <button id="delete-confirm-confirm" type="button" class="btn btn--danger">Remove</button>
              </div>
            </div>
          </div>`
        : ''
    }

    <div id="toast-container" class="toast-container" aria-live="polite"></div>
    <div id="loading-overlay" class="loading-overlay" hidden>
      <div class="loading-overlay__spinner" aria-hidden="true"></div>
      <p>Loading your collection…</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Form handling
// ---------------------------------------------------------------------------

function readDraft(form: HTMLFormElement): CandleDraft | null {
  const name = (form.elements.namedItem('name') as HTMLInputElement | null)?.value ?? '';
  const brand = (form.elements.namedItem('brand') as HTMLInputElement | null)?.value ?? '';
  const scentNotes =
    (form.elements.namedItem('scentNotes') as HTMLInputElement | null)?.value ?? '';
  const status = (form.elements.namedItem('status') as HTMLSelectElement | null)
    ?.value as CandleStatus;
  const notes = (form.elements.namedItem('notes') as HTMLTextAreaElement | null)?.value ?? '';

  const ratingInput = form.elements.namedItem('rating') as RadioNodeList | null;
  const rating = ratingInput?.value ? Number(ratingInput.value) : null;

  if (!name || !brand || !rating) return null;

  return {
    name,
    brand,
    scentNotes,
    status,
    rating: rating as CandleDraft['rating'],
    notes,
  };
}

function handleSubmit(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.target as HTMLFormElement;

  const draft = readDraft(form);
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
      const created = createCandleFromDraft(draft);
      state.candles = [created, ...state.candles];
      showToast('Candle added to your collection.', 'success');
    }
    state.editingId = null;
    persist();
  } catch (err) {
    if (err instanceof ValidationError) {
      showToast('Check the highlighted fields: ' + err.fields.join(', ') + '.', 'error');
    } else {
      showToast('Something went wrong while saving.', 'error');
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function persist(): void {
  setLoading(true);
  // Defer to let the browser paint the loading state before the write.
  window.setTimeout(() => {
    const result = saveCandles(state.candles);
    setLoading(false);
    if (!result.ok) {
      showToast(result.error ?? 'Could not save.', 'error');
    }
    render();
  }, 0);
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

function handleAction(target: HTMLElement): void {
  const action = target.dataset.action;
  const id = target.dataset.id;
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
    if ((event.target as HTMLElement).id === 'candle-form') {
      handleSubmit(event);
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('#delete-confirm-confirm')) {
      handleDeleteConfirm();
      return;
    }
    if (target.closest('#delete-confirm-cancel')) {
      handleDeleteCancel();
      return;
    }

    const actionTarget = target.closest<HTMLElement>('[data-action]');
    if (actionTarget) {
      handleAction(actionTarget);
    }
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
      state.sort = {
        key: key as SortKey,
        direction: direction as SortState['direction'],
      };
      render();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot(): void {
  if (!root) return;

  setLoading(true);
  render();

  // Simulate a small async load so the loading state is actually observable
  // and we never assume storage access is synchronous.
  window.setTimeout(() => {
    const result = loadCandles();
    if (!result.ok && result.error) {
      showToast(result.error, 'error');
    } else if (result.error) {
      showToast(result.error, 'info');
    }
    state.candles = result.candles;
    setLoading(false);
    bindEvents();
    render();
  }, 250);
}

boot();
