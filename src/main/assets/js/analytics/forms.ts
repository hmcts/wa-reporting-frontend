export function getScrollStorageKey(): string {
  return `analytics:scroll:${window.location.pathname}`;
}

export function storeScrollPosition(): void {
  try {
    window.sessionStorage.setItem(getScrollStorageKey(), String(window.scrollY));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to store scroll position', error);
  }
}

export function restoreScrollPosition(): void {
  try {
    const raw = window.sessionStorage.getItem(getScrollStorageKey());
    if (!raw) {
      return;
    }
    window.sessionStorage.removeItem(getScrollStorageKey());
    const scrollY = Number(raw);
    if (Number.isFinite(scrollY)) {
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to restore scroll position', error);
  }
}

export function getAnalyticsFiltersForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>('form[data-analytics-filters="true"]');
}

export function setHiddenInput(form: HTMLFormElement, name: string, value: string): void {
  let input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    form.appendChild(input);
  }
  input.value = value;
}

export function initAutoSubmitForms(): void {
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-auto-submit="true"]');
  forms.forEach(form => {
    if (form.dataset.autoSubmitBound === 'true') {
      return;
    }
    form.addEventListener('change', event => {
      const target = event.target;
      if (target instanceof HTMLInputElement && (target.type === 'radio' || target.type === 'checkbox')) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
      }
    });
    form.dataset.autoSubmitBound = 'true';
  });
}

export function getFilterStorageKey(_form: HTMLFormElement): string {
  return 'analyticsFilters:global';
}

export function getAutoSubmitKey(form: HTMLFormElement): string {
  const names = Array.from(form.elements)
    .map(element =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
        ? element.name
        : ''
    )
    .filter(name => name && name !== '_csrf');
  const unique = Array.from(new Set(names))
    .sort((a, b) => a.localeCompare(b))
    .join('|');
  return `analyticsFilters:autoSubmit:${window.location.pathname}:${unique}`;
}

export function getFormFieldNames(form: HTMLFormElement): string[] {
  const names = Array.from(form.elements)
    .map(element =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
        ? element.name
        : ''
    )
    .filter(name => name && name !== '_csrf');
  return Array.from(new Set(names));
}

export function escapeForSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

export function serialiseFilters(form: HTMLFormElement): Record<string, string[]> {
  const data: Record<string, string[]> = {};
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    if (key === '_csrf') {
      return;
    }
    const rawValue = String(value);
    if (!rawValue.trim()) {
      return;
    }
    const current = data[key] ?? [];
    current.push(rawValue);
    data[key] = current;
  });
  return data;
}

export function filterDataForForm(form: HTMLFormElement, data: Record<string, string[]>): Record<string, string[]> {
  const filtered: Record<string, string[]> = {};
  Object.entries(data).forEach(([name, values]) => {
    const selector = `[name="${escapeForSelector(name)}"]`;
    if (form.querySelector(selector)) {
      filtered[name] = values;
    }
  });
  return filtered;
}

export function normaliseMultiSelectSelections(form: HTMLFormElement): void {
  const groups = form.querySelectorAll<HTMLDetailsElement>('[data-module="analytics-multiselect"]');
  groups.forEach(details => {
    const items = Array.from(details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]'));
    if (items.length === 0) {
      return;
    }
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length !== items.length) {
      return;
    }
    items.forEach(item => {
      item.checked = false;
    });
    const selectAll = details.querySelector<HTMLInputElement>('[data-select-all]');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
  });
}

export function hasStoredValues(data: Record<string, string[]>): boolean {
  return Object.values(data).some(values => values.length > 0);
}

export function applyFilters(form: HTMLFormElement, data: Record<string, string[]>): void {
  Object.entries(data).forEach(([name, values]) => {
    const selector = `[name="${escapeForSelector(name)}"]`;
    const elements = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)
    );
    elements.forEach(element => {
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        element.checked = values.includes(element.value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      element.value = values[0] ?? '';
    });
  });
}

export function formHasValues(form: HTMLFormElement): boolean {
  const elements = Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  return elements.some(element => {
    if (!('name' in element) || !element.name || element.name === '_csrf') {
      return false;
    }
    if (element instanceof HTMLInputElement) {
      if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
        return false;
      }
    }
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      return element.checked;
    }
    return element.value.trim().length > 0;
  });
}

export function initFilterPersistence(): void {
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-analytics-filters="true"]');
  forms.forEach(form => {
    const storageKey = getFilterStorageKey(form);
    const autoSubmitKey = getAutoSubmitKey(form);
    const resetButtons = form.querySelectorAll<HTMLElement>('[data-analytics-filters-reset="true"]');

    resetButtons.forEach(button => {
      button.addEventListener('click', () => {
        window.localStorage.removeItem(storageKey);
      });
    });

    form.addEventListener('submit', () => {
      normaliseMultiSelectSelections(form);
      const data = serialiseFilters(form);
      const existingRaw = window.localStorage.getItem(storageKey);
      const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, string[]>) : {};
      const fieldNames = getFormFieldNames(form);
      fieldNames.forEach(name => {
        delete existing[name];
      });
      Object.entries(data).forEach(([name, values]) => {
        if (values.length > 0) {
          existing[name] = values;
        }
      });
      if (hasStoredValues(existing)) {
        window.localStorage.setItem(storageKey, JSON.stringify(existing));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    });

    if (formHasValues(form)) {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }
    try {
      const data = JSON.parse(raw) as Record<string, string[]>;
      if (!hasStoredValues(data)) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      const formData = filterDataForForm(form, data);
      if (!hasStoredValues(formData)) {
        return;
      }
      applyFilters(form, formData);
      if (!formHasValues(form)) {
        return;
      }
      const fingerprint = JSON.stringify(formData);
      if (window.sessionStorage.getItem(autoSubmitKey) === fingerprint) {
        return;
      }
      window.sessionStorage.setItem(autoSubmitKey, fingerprint);
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  });
}

export function initMultiSelects(): void {
  const nodes = document.querySelectorAll<HTMLDetailsElement>('[data-module="analytics-multiselect"]');
  nodes.forEach(details => {
    if (details.dataset.multiselectBound === 'true') {
      return;
    }
    const summary = details.querySelector<HTMLElement>('[data-multiselect-summary]');
    const selectAll = details.querySelector<HTMLInputElement>('[data-select-all]');
    const items = Array.from(details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]'));
    const searchInput = details.querySelector<HTMLInputElement>('[data-multiselect-search="true"]');
    const searchCount = details.querySelector<HTMLElement>('[data-multiselect-search-count="true"]');
    const itemEntries = items
      .map(item => {
        const wrapper = item.closest<HTMLElement>('.govuk-checkboxes__item');
        if (!wrapper) {
          return null;
        }
        const label = (item.dataset.itemLabel ?? item.value).toLowerCase();
        return { item, wrapper, label };
      })
      .filter((entry): entry is { item: HTMLInputElement; wrapper: HTMLElement; label: string } => entry !== null);
    const allText = details.dataset.allText ?? 'All';

    const getSelectableItems = () => {
      if (!searchInput) {
        return itemEntries;
      }
      const term = searchInput.value.trim().toLowerCase();
      if (!term) {
        return itemEntries;
      }
      return itemEntries.filter(entry => entry.wrapper.style.display !== 'none');
    };

    const updateSearch = () => {
      if (!searchInput) {
        return;
      }
      const term = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      itemEntries.forEach(entry => {
        const match = term.length === 0 || entry.label.includes(term);
        entry.wrapper.style.display = match ? '' : 'none';
        entry.wrapper.setAttribute('aria-hidden', match ? 'false' : 'true');
        if (match) {
          visibleCount += 1;
        }
      });
      if (searchCount) {
        if (term.length === 0) {
          searchCount.textContent = `${itemEntries.length} options`;
        } else if (visibleCount === 0) {
          searchCount.textContent = 'No matching options';
        } else {
          searchCount.textContent = `${visibleCount} of ${itemEntries.length} options`;
        }
      }
    };

    const updateSummary = () => {
      if (!summary) {
        return;
      }
      const checkedItems = items.filter(item => item.checked);
      if (checkedItems.length === 0 || checkedItems.length === items.length) {
        summary.textContent = allText;
        return;
      }
      if (checkedItems.length === 1) {
        summary.textContent = checkedItems[0]?.dataset.itemLabel ?? checkedItems[0]?.value ?? allText;
        return;
      }
      summary.textContent = `${checkedItems.length} selected`;
    };

    const updateSelectAllState = () => {
      if (!selectAll) {
        return;
      }
      const selectable = getSelectableItems();
      const checkedCount = selectable.filter(entry => entry.item.checked).length;
      selectAll.checked = selectable.length > 0 && checkedCount === selectable.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < selectable.length;
    };

    const updateAll = () => {
      updateSelectAllState();
      updateSummary();
    };

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const shouldCheck = selectAll.checked;
        const selectable = getSelectableItems();
        selectable.forEach(entry => {
          entry.item.checked = shouldCheck;
        });
        updateAll();
      });
    }

    items.forEach(item => {
      item.addEventListener('change', updateAll);
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        updateSearch();
        updateAll();
      });
    }

    details.addEventListener('keydown', event => {
      if (event.key !== 'Escape') {
        return;
      }
      details.open = false;
      details.querySelector<HTMLElement>('summary')?.focus();
    });

    document.addEventListener('click', event => {
      if (!details.open) {
        return;
      }
      if (!details.contains(event.target as Node)) {
        details.open = false;
      }
    });

    updateSearch();
    updateAll();
    details.dataset.multiselectBound = 'true';
  });
}
