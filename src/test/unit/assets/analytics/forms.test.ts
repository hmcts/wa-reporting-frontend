/* @jest-environment jsdom */
import {
  escapeForSelector,
  formHasValues,
  getAutoSubmitKey,
  getFilterStorageKey,
  getScrollStorageKey,
  initAutoSubmitForms,
  initFilterPersistence,
  initMultiSelects,
  normaliseMultiSelectSelections,
  restoreScrollPosition,
  serialiseFilters,
  setHiddenInput,
  storeScrollPosition,
} from '../../../../main/assets/js/analytics/forms';

import { setupAnalyticsDom } from './analyticsTestUtils';

describe('analytics forms', () => {
  const originalCss = (global as { CSS?: typeof CSS }).CSS;

  afterAll(() => {
    (global as { CSS?: typeof CSS }).CSS = originalCss;
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

  test('escapes selectors and updates hidden inputs', () => {
    (global as { CSS?: { escape?: (value: string) => string } }).CSS = { escape: value => `ok-${value}` };
    expect(escapeForSelector('foo')).toBe('ok-foo');
    (global as { CSS?: { escape?: (value: string) => string } }).CSS = undefined;
    expect(escapeForSelector('"field"')).toBe('\\"field\\"');

    const form = document.createElement('form');
    setHiddenInput(form, 'test', 'value-1');
    setHiddenInput(form, 'test', 'value-2');
    const input = form.querySelector<HTMLInputElement>('input[name="test"]');
    expect(input?.value).toBe('value-2');
  });

  test('persists filters and wires multiselects', () => {
    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    const textInput = document.createElement('input');
    textInput.name = 'service';
    textInput.value = '';
    form.appendChild(textInput);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'region';
    checkbox.value = 'North';
    form.appendChild(checkbox);

    const resetButton = document.createElement('button');
    resetButton.dataset.analyticsFiltersReset = 'true';
    resetButton.type = 'button';
    form.appendChild(resetButton);

    const details = document.createElement('details');
    details.dataset.module = 'analytics-multiselect';
    details.innerHTML = `
      <summary data-multiselect-summary="true">All</summary>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="North" checked />
      </div>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="South" checked />
      </div>
      <input type="checkbox" data-select-all="true" checked />
      <input type="text" data-multiselect-search="true" value="" />
      <span data-multiselect-search-count="true"></span>
    `;
    form.appendChild(details);
    document.body.appendChild(form);

    window.localStorage.setItem(
      getFilterStorageKey(form),
      JSON.stringify({ service: ['Service A'], region: ['North'] })
    );

    const requestSubmit = jest.fn();
    form.requestSubmit = requestSubmit;

    initFilterPersistence();
    initMultiSelects();

    expect(textInput.value).toBe('Service A');
    expect(checkbox.checked).toBe(true);
    expect(requestSubmit).toHaveBeenCalled();

    resetButton.click();
    expect(window.localStorage.getItem(getFilterStorageKey(form))).toBeNull();

    form.dispatchEvent(new Event('submit'));
    expect(window.localStorage.getItem(getFilterStorageKey(form))).toContain('service');

    const prefilledForm = document.createElement('form');
    prefilledForm.dataset.analyticsFilters = 'true';
    const prefilledInput = document.createElement('input');
    prefilledInput.name = 'service';
    prefilledInput.value = 'Existing';
    prefilledForm.appendChild(prefilledInput);
    prefilledForm.requestSubmit = jest.fn();
    document.body.appendChild(prefilledForm);
    initFilterPersistence();
    expect(prefilledForm.requestSubmit).not.toHaveBeenCalled();
  });

  test('covers filter persistence edge cases', () => {
    const emptyForm = document.createElement('form');
    emptyForm.dataset.analyticsFilters = 'true';
    const csrfInput = document.createElement('input');
    csrfInput.name = '_csrf';
    csrfInput.value = 'token';
    const blankInput = document.createElement('input');
    blankInput.name = 'service';
    blankInput.value = ' ';
    emptyForm.appendChild(csrfInput);
    emptyForm.appendChild(blankInput);
    emptyForm.requestSubmit = jest.fn();
    document.body.appendChild(emptyForm);

    initFilterPersistence();
    expect(serialiseFilters(emptyForm)).toEqual({});

    window.localStorage.setItem(getFilterStorageKey(emptyForm), JSON.stringify({}));
    initFilterPersistence();
    expect(window.localStorage.getItem(getFilterStorageKey(emptyForm))).toBeNull();

    const unmatchedForm = document.createElement('form');
    unmatchedForm.dataset.analyticsFilters = 'true';
    unmatchedForm.requestSubmit = jest.fn();
    document.body.appendChild(unmatchedForm);
    window.localStorage.setItem(getFilterStorageKey(unmatchedForm), JSON.stringify({ other: ['x'] }));
    initFilterPersistence();
    expect(unmatchedForm.requestSubmit).not.toHaveBeenCalled();

    const emptyValueForm = document.createElement('form');
    emptyValueForm.dataset.analyticsFilters = 'true';
    const emptyValueInput = document.createElement('input');
    emptyValueInput.name = 'service';
    emptyValueForm.appendChild(emptyValueInput);
    emptyValueForm.requestSubmit = jest.fn();
    document.body.appendChild(emptyValueForm);
    window.localStorage.setItem(getFilterStorageKey(emptyValueForm), JSON.stringify({ service: [''] }));
    initFilterPersistence();

    const fingerprintForm = document.createElement('form');
    fingerprintForm.dataset.analyticsFilters = 'true';
    const fingerprintInput = document.createElement('input');
    fingerprintInput.name = 'service';
    fingerprintForm.appendChild(fingerprintInput);
    fingerprintForm.requestSubmit = jest.fn();
    document.body.appendChild(fingerprintForm);
    const fingerprintData = { service: ['Alpha'] };
    window.localStorage.setItem(getFilterStorageKey(fingerprintForm), JSON.stringify(fingerprintData));
    const autoSubmitKey = getAutoSubmitKey(fingerprintForm);
    window.sessionStorage.setItem(autoSubmitKey, JSON.stringify(fingerprintData));
    initFilterPersistence();
    expect(fingerprintForm.requestSubmit).not.toHaveBeenCalled();

    const submitFallbackForm = document.createElement('form');
    submitFallbackForm.dataset.analyticsFilters = 'true';
    const submitInput = document.createElement('input');
    submitInput.name = 'service';
    submitFallbackForm.appendChild(submitInput);
    submitFallbackForm.requestSubmit = undefined as unknown as HTMLFormElement['requestSubmit'];
    submitFallbackForm.submit = jest.fn();
    document.body.appendChild(submitFallbackForm);
    window.localStorage.setItem(getFilterStorageKey(submitFallbackForm), JSON.stringify({ service: ['Beta'] }));
    initFilterPersistence();
    expect(submitFallbackForm.submit).toHaveBeenCalled();

    const brokenForm = document.createElement('form');
    brokenForm.dataset.analyticsFilters = 'true';
    document.body.appendChild(brokenForm);
    window.localStorage.setItem(getFilterStorageKey(brokenForm), '{bad');
    initFilterPersistence();
    expect(window.localStorage.getItem(getFilterStorageKey(brokenForm))).toBeNull();

    const submitCleanupForm = document.createElement('form');
    submitCleanupForm.dataset.analyticsFilters = 'true';
    const cleanupInput = document.createElement('input');
    cleanupInput.name = 'service';
    cleanupInput.value = '';
    submitCleanupForm.appendChild(cleanupInput);
    document.body.appendChild(submitCleanupForm);
    window.localStorage.setItem(getFilterStorageKey(submitCleanupForm), JSON.stringify({ service: ['Old'] }));
    initFilterPersistence();
    submitCleanupForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const hiddenForm = document.createElement('form');
    const hiddenInput = document.createElement('input');
    hiddenInput.name = 'hidden';
    hiddenInput.type = 'hidden';
    hiddenForm.appendChild(hiddenInput);
    const submitButton = document.createElement('button');
    submitButton.name = 'submit';
    submitButton.type = 'submit';
    hiddenForm.appendChild(submitButton);
    expect(formHasValues(hiddenForm)).toBe(false);

    const details = document.createElement('details');
    details.dataset.module = 'analytics-multiselect';
    details.innerHTML = '<div class="govuk-checkboxes__item"></div>';
    emptyForm.appendChild(details);
    normaliseMultiSelectSelections(emptyForm);

    const partialDetails = document.createElement('details');
    partialDetails.dataset.module = 'analytics-multiselect';
    partialDetails.innerHTML = `
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="A" checked />
      </div>
      <div class="govuk-checkboxes__item">
        <input type="checkbox" data-multiselect-item="true" value="B" />
      </div>
    `;
    emptyForm.appendChild(partialDetails);
    normaliseMultiSelectSelections(emptyForm);
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
});
