# wa-reporting-frontend

## Getting Started

### Prerequisites

Running the application requires the following tools to be installed in your environment:

- [Node.js](https://nodejs.org/) v12.0.0 or later
- [yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com)

### Running the application

Install dependencies by executing the following command:

```bash
yarn install
```

Generate the Prisma client:

```bash
yarn prisma generate
```

Bundle:

```bash
yarn webpack
```

Run:

```bash
yarn start
```

The analytics landing page will be available at http://localhost:3100/

### Analytics dashboards

Build assets (main + analytics bundles):

```bash
yarn build
```

Run the app and visit:

- http://localhost:3100/analytics/overview
- http://localhost:3100/analytics/outstanding
- http://localhost:3100/analytics/completed
- http://localhost:3100/analytics/users/{userId}
- http://localhost:3100/analytics/task-audit/{caseId}

Notes:

- Plotly charts use GOV.UK-aligned priority colors defined in `src/main/assets/scss/main.scss`.
- Each chart has a data-table alternative via the GOV.UK toggle pattern for accessibility.

### Running with Docker

Create docker image:

```bash
docker-compose build
```

Run the application by executing the following command:

```bash
docker-compose up
```

This will start the frontend container exposing the application's port
(set to `3100` in this template app).

In order to test if the application is up, you can visit https://localhost:3100 in your browser.
You should get the analytics landing page.

## Developing

### Code style

We use [ESLint](https://github.com/typescript-eslint/typescript-eslint)
alongside [sass-lint](https://github.com/sasstools/sass-lint)

Running the linting with auto fix:

```bash
yarn lint --fix
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

Functional tests (Playwright, requires the app running at http://localhost:3100):

```bash
TEST_URL=http://localhost:3100 yarn test:functional
```

Running accessibility tests (Playwright, starts the app automatically if needed):

```bash
AUTH_ENABLED=false TEST_URL=http://localhost:3100 yarn test:a11y
```

Make sure all the paths in your application are covered by accessibility tests (see `src/test/a11y/*.a11y.spec.ts`).

### Security

#### CSRF prevention

[Cross-Site Request Forgery](https://github.com/pillarjs/understanding-csrf) prevention has already been
set up in this template, at the application level. However, you need to make sure that CSRF token
is present in every HTML form that requires it. For that purpose you can use the `csrfProtection` macro,
included in this template app. Your njk file would look like this:

```
{% from "macros/csrf.njk" import csrfProtection %}
...
<form ...>
  ...
    {{ csrfProtection(csrfToken) }}
  ...
</form>
...
```

#### Helmet

This application uses [Helmet](https://helmetjs.github.io/), which adds various security-related HTTP headers
to the responses. Apart from default Helmet functions, following headers are set:

- [Referrer-Policy](https://helmetjs.github.io/docs/referrer-policy/)
- [Content-Security-Policy](https://helmetjs.github.io/docs/csp/)

There is a configuration section related with those headers, where you can specify:

- `referrerPolicy` - value of the `Referrer-Policy` header

Here's an example setup:

```json
    "security": {
      "referrerPolicy": "origin",
    }
```

Make sure you have those values set correctly for your application.

### Healthcheck

The application exposes a health endpoint (https://localhost:3100/health), created with the use of
[Nodejs Healthcheck](https://github.com/hmcts/nodejs-healthcheck) library. This endpoint is defined
in [health.ts](src/main/routes/health.ts) file. Make sure you adjust it correctly in your application.
In particular, remember to replace the sample check with checks specific to your frontend app,
e.g. the ones verifying the state of each service it depends on.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
