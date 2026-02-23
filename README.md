# wa-reporting-frontend

## Getting Started

### Prerequisites

Running the application requires the following tools to be installed in your environment:

- [Node.js](https://nodejs.org/) v20.19.0 or later
- [yarn](https://yarnpkg.com/) v4
- [Docker](https://www.docker.com)

### Running the application

Install dependencies by executing the following command:

```bash
yarn install
```

Run in development mode:

```bash
AUTH_ENABLED=false yarn start:dev
```

The analytics landing page will be available at http://localhost:3100/

To run the compiled app with `yarn start`, build server and production assets first:

```bash
yarn build:server
yarn build:prod
AUTH_ENABLED=false yarn start
```

The running application is available at http://localhost:3100/

### Running with Docker

Create docker image:

```bash
docker-compose build
```

Run the application by executing the following command:

```bash
docker-compose up
```

This will start the frontend container and a Redis container for session storage,
exposing the application's port (set to `3100` in this template app).

In order to test if the application is up, you can visit http://localhost:3100 in your browser.
You should get the analytics landing page.

## Developing

### Code style

We use [ESLint](https://github.com/typescript-eslint/typescript-eslint)
alongside [Stylelint](https://stylelint.io/) and [Prettier](https://prettier.io/)

Running the linting with auto fix:

```bash
yarn lint:fix
```

### Running the tests

This template app uses [Jest](https://jestjs.io//) as the test engine. You can run unit tests by executing
the following command:

```bash
yarn test
```

Route tests:

```bash
yarn test:routes
```

Smoke tests (Playwright, requires the app running at http://localhost:3100):

```bash
TEST_URL=http://localhost:3100 yarn test:smoke
```

If auth is enabled, provide IDAM credentials so Playwright can log in and cache the session:

```bash
TEST_URL=http://localhost:3100 \
TEST_IDAM_USERNAME=caseworker@example.com \
TEST_IDAM_PASSWORD=*** \
yarn test:smoke
```

The first authenticated run performs a full IDAM login and stores cookies in
`src/test/playwright/.sessions/idam-session.json`. Delete that file to force a
fresh login. If the session cookie name differs, set `AUTH_SESSION_COOKIE_NAME`.

Functional tests (Playwright, requires the app running at http://localhost:3100):

```bash
TEST_URL=http://localhost:3100 yarn test:functional
```

If auth is enabled, provide the same IDAM credentials as for smoke tests.
If Edge is enabled in Playwright projects, install it first with `yarn setup:edge`.

Running accessibility tests (Playwright, starts the app automatically if needed):

```bash
AUTH_ENABLED=false TEST_URL=http://localhost:3100 yarn test:a11y
```

### Healthcheck

The application exposes a health endpoint at http://localhost:3100/health

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
