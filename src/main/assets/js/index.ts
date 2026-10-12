import '../scss/main.scss';
import { initAll as initMojAll } from '@ministryofjustice/frontend';
import { initAll } from 'govuk-frontend';
import { initializeSessionTimeout } from './sessionTimeout';

initAll();
initMojAll();
initializeSessionTimeout();
