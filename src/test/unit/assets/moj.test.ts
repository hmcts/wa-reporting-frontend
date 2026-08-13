/* @jest-environment jsdom */
import { SortableTable } from '@ministryofjustice/frontend/moj/components/sortable-table/sortable-table.mjs';

import { initMojAll } from '../../../main/assets/js/moj';

jest.mock('@ministryofjustice/frontend/moj/components/sortable-table/sortable-table.mjs', () => ({
  SortableTable: jest.fn(),
}));

describe('MOJ frontend bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (SortableTable as jest.Mock).mockClear();
  });

  it('initialises sortable tables in the document by default', () => {
    document.body.innerHTML = '<table data-module="moj-sortable-table"></table>';

    initMojAll();

    expect(SortableTable).toHaveBeenCalledWith(document.querySelector('table'));
  });

  it('initialises sortable tables in the provided scope', () => {
    document.body.innerHTML = `
      <div id="outside"><table data-module="moj-sortable-table"></table></div>
      <div id="scope"><table data-module="moj-sortable-table"></table></div>
    `;
    const scope = document.querySelector('#scope') as Element;

    initMojAll({ scope });

    expect(SortableTable).toHaveBeenCalledTimes(1);
    expect(SortableTable).toHaveBeenCalledWith(scope.querySelector('table'));
  });

  it('accepts a scope element directly', () => {
    document.body.innerHTML = '<div id="scope"><table data-module="moj-sortable-table"></table></div>';
    const scope = document.querySelector('#scope') as Element;

    initMojAll(scope);

    expect(SortableTable).toHaveBeenCalledWith(scope.querySelector('table'));
  });

  it('ignores an explicit null scope option', () => {
    document.body.innerHTML = '<table data-module="moj-sortable-table"></table>';

    initMojAll({ scope: null });

    expect(SortableTable).not.toHaveBeenCalled();
  });

  it('ignores a direct null scope', () => {
    document.body.innerHTML = '<table data-module="moj-sortable-table"></table>';

    initMojAll(null);

    expect(SortableTable).not.toHaveBeenCalled();
  });

  it('continues when one sortable table fails to initialise', () => {
    document.body.innerHTML = `
      <table id="first" data-module="moj-sortable-table"></table>
      <table id="second" data-module="moj-sortable-table"></table>
    `;
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    (SortableTable as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Failed');
    });

    initMojAll();

    expect(SortableTable).toHaveBeenCalledTimes(2);
    expect(consoleLog).toHaveBeenCalledWith(expect.any(Error));

    consoleLog.mockRestore();
  });
});
