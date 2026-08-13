import '../scss/main.scss';
import { initAll } from 'govuk-frontend';
import { initializeSessionTimeout } from './sessionTimeout';
import { initMojAll } from './moj';

initAll();
initMojAll();
initializeSessionTimeout();
