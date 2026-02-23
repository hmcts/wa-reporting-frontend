/* @jest-environment jsdom */
import {
  clearLocationHash,
  getAnalyticsFiltersForm,
  getScrollStorageKey,
  initAutoSubmitForms,
  initFilterPersistence,
  initMultiSelects,
  normaliseMultiSelectSelections,
  restoreScrollPosition,
  setHiddenInput,
  storeScrollPosition,
} from '../../../../main/assets/js/analytics/forms';

import { setupAnalyticsDom } from './analyticsTestUtils';

describe('analytics forms', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    setupAnalyticsDom();
  });

  test('persists and restores scroll position', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    storeScrollPosition();

    const key = getScrollStorageKey();
    expect(window.sessionStorage.getItem(key)).toBe('120');

    restoreScrollPosition();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 120, left: 0, behavior: 'auto' });
    expect(window.sessionStorage.getItem(key)).toBeNull();

    restoreScrollPosition();
    expect((window.scrollTo as jest.Mock).mock.calls).toHaveLength(1);

    window.sessionStorage.setItem(key, 'not-a-number');
    restoreScrollPosition();
    expect((window.scrollTo as jest.Mock).mock.calls).toHaveLength(1);

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    storeScrollPosition();
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    restoreScrollPosition();
    expect(warnSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('finds analytics filter forms and updates hidden inputs', () => {
    expect(getAnalyticsFiltersForm()).toBeNull();

    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    document.body.appendChild(form);

    expect(getAnalyticsFiltersForm()).toBe(form);

    setHiddenInput(form, 'test', 'value-1');
    setHiddenInput(form, 'test', 'value-2');
    const input = form.querySelector<HTMLInputElement>('input[name="test"]');
    expect(input?.value).toBe('value-2');
  });

  test('normalises multi-select selections on filter submit', () => {
    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';

    const details = document.createElement('details');
    details.dataset.module = 'analytics-multiselect';
    details.innerHTML = `
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="North" checked />
      </div>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="South" checked />
      </div>
      <input type="checkbox" data-select-all="true" checked />
    `;
    form.appendChild(details);
    document.body.appendChild(form);

    initFilterPersistence();
    form.dispatchEvent(new Event('submit', { bubbles: true }));

    const items = details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]');
    expect(items[0].checked).toBe(false);
    expect(items[1].checked).toBe(false);
    const selectAll = details.querySelector<HTMLInputElement>('[data-select-all]');
    expect(selectAll?.checked).toBe(false);
  });

  test('clears URL hash on non-ajax filter submit', () => {
    window.history.replaceState({}, '', '/outstanding?service=Crime#openTasksTable');

    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    document.body.appendChild(form);

    initFilterPersistence();
    form.dispatchEvent(new Event('submit', { bubbles: true }));

    expect(window.location.pathname).toBe('/outstanding');
    expect(window.location.search).toBe('?service=Crime');
    expect(window.location.hash).toBe('');
  });

  test('does not clear URL hash on ajax section filter submit', () => {
    window.history.replaceState({}, '', '/outstanding?service=Crime#openTasksTable');

    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    form.dataset.ajaxSection = 'open-tasks-summary';
    document.body.appendChild(form);

    initFilterPersistence();
    form.dispatchEvent(new Event('submit', { bubbles: true }));

    expect(window.location.hash).toBe('#openTasksTable');
  });

  test('clearLocationHash is a no-op when hash is absent', () => {
    window.history.replaceState({}, '', '/outstanding?service=Crime');
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    clearLocationHash();

    expect(replaceStateSpy).not.toHaveBeenCalled();
    replaceStateSpy.mockRestore();
  });

  test('normaliseMultiSelectSelections leaves partial selections unchanged', () => {
    const form = document.createElement('form');
    const details = document.createElement('details');
    details.dataset.module = 'analytics-multiselect';
    details.innerHTML = `
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="A" checked />
      </div>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="B" />
      </div>
    `;
    form.appendChild(details);

    normaliseMultiSelectSelections(form);

    const items = details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]');
    expect(items[0].checked).toBe(true);
    expect(items[1].checked).toBe(false);
  });

  test('updates multiselect summaries and handles focus escape', () => {
    const details = document.createElement('details');
    details.dataset.module = 'analytics-multiselect';
    details.open = true;
    details.innerHTML = `
      <summary data-multiselect-summary="true">All</summary>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="One" />
      </div>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="Two" data-item-label="Label Two" />
      </div>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="Three" />
      </div>
      <input type="checkbox" data-select-all="true" />
      <input type="text" data-multiselect-search="true" value="" />
      <span data-multiselect-search-count="true"></span>
    `;
    document.body.appendChild(details);

    initMultiSelects();
    const selectAll = details.querySelector<HTMLInputElement>('[data-select-all="true"]');
    if (selectAll) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event('change'));
    }
    const summary = details.querySelector('[data-multiselect-summary="true"]');
    expect(summary?.textContent).toBe('All');

    const searchInput = details.querySelector<HTMLInputElement>('[data-multiselect-search="true"]');
    if (searchInput) {
      searchInput.value = 'two';
      searchInput.dispatchEvent(new Event('input'));
    }
    expect(details.querySelector('[data-multiselect-search-count="true"]')?.textContent).toContain('1 of 3');

    if (searchInput) {
      searchInput.value = 'missing';
      searchInput.dispatchEvent(new Event('input'));
    }
    expect(details.querySelector('[data-multiselect-search-count="true"]')?.textContent).toContain(
      'No matching options'
    );

    const items = details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]');
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
    if (selectAll) {
      selectAll.checked = false;
      selectAll.dispatchEvent(new Event('change'));
    }
    items[0].checked = true;
    items[0].dispatchEvent(new Event('change', { bubbles: true }));
    expect(summary?.textContent).toBe('One');
    items[1].checked = true;
    items[1].dispatchEvent(new Event('change', { bubbles: true }));
    expect(summary?.textContent).toContain('selected');

    const noSummaryDetails = document.createElement('details');
    noSummaryDetails.dataset.module = 'analytics-multiselect';
    noSummaryDetails.innerHTML = `
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="Only" />
      </div>
    `;
    document.body.appendChild(noSummaryDetails);
    initMultiSelects();

    const orphanDetails = document.createElement('details');
    orphanDetails.dataset.module = 'analytics-multiselect';
    orphanDetails.innerHTML = '<input type="checkbox" data-multiselect-item="true" value="Orphan" />';
    document.body.appendChild(orphanDetails);
    initMultiSelects();

    const noSearchDetails = document.createElement('details');
    noSearchDetails.dataset.module = 'analytics-multiselect';
    noSearchDetails.innerHTML = `
      <summary data-multiselect-summary="true">All</summary>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="One" />
      </div>
      <input type="checkbox" data-select-all="true" />
    `;
    document.body.appendChild(noSearchDetails);
    initMultiSelects();

    details.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(details.open).toBe(false);

    details.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    details.open = true;
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(details.open).toBe(false);
  });

  test('auto-submits filter forms on checkbox changes', () => {
    const form = document.createElement('form');
    form.dataset.autoSubmit = 'true';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    form.appendChild(checkbox);
    form.requestSubmit = jest.fn();
    document.body.appendChild(form);

    const fallbackForm = document.createElement('form');
    fallbackForm.dataset.autoSubmit = 'true';
    const fallbackCheckbox = document.createElement('input');
    fallbackCheckbox.type = 'checkbox';
    fallbackForm.appendChild(fallbackCheckbox);
    fallbackForm.requestSubmit = undefined as unknown as HTMLFormElement['requestSubmit'];
    const submitSpy = jest.spyOn(fallbackForm, 'submit').mockImplementation(() => {});
    document.body.appendChild(fallbackForm);

    initAutoSubmitForms();
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    fallbackCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(form.requestSubmit).toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalled();
  });

  test('skips rebinding auto-submit listeners when already bound', () => {
    const form = document.createElement('form');
    form.dataset.autoSubmit = 'true';
    form.dataset.autoSubmitBound = 'true';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    form.appendChild(checkbox);
    form.requestSubmit = jest.fn();
    document.body.appendChild(form);

    initAutoSubmitForms();
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(form.requestSubmit).not.toHaveBeenCalled();
  });
});
