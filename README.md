# wa-reporting-frontend

Task Management Report is a TypeScript/Express application that renders GOV.UK-style analytics dashboards over snapshot-backed task-management data.

Start with [docs/README.md](docs/README.md) for the checked-in functional and technical specifications, and read [AGENTS.md](AGENTS.md) for the repository’s contributor guidance and quality expectations.

## Prerequisites

- [Node.js](https://nodejs.org/) v20.19.0 or later
- [Yarn](https://yarnpkg.com/) v4
- [Docker](https://www.docker.com) for local container workflows

## Install

```bash
yarn install
```

## Run Locally

For the standard local workflow, disable OIDC and start the development server:

```bash
AUTH_ENABLED=false yarn start:dev
```

The application will be available at [http://localhost:3100](http://localhost:3100).

## Build and Run the Compiled App

The repository splits build responsibilities across separate scripts:

- `yarn build`: builds frontend webpack assets only
- `yarn build:server`: compiles server TypeScript into `dist/`
- `yarn build:prod`: builds production frontend assets and copies static/views into `dist/main`

To run the compiled application with `yarn start`, build both the server and production assets first:

```bash
yarn build:server
yarn build:prod
AUTH_ENABLED=false yarn start
```

`yarn start` runs the compiled server from `dist/main/server.js`.

## Docker

Build and run the local Docker setup with:

```bash
docker-compose build
docker-compose up
```

This starts the frontend container and a Redis container for session storage, exposing port `3100`.

## Quality Checks

Common repository commands:

- `yarn lint`
- `yarn test:unit`
- `yarn test`
- `yarn test:coverage`
- `yarn test:routes`
- `yarn test:a11y`
- `yarn test:smoke`
- `yarn test:functional`
- `yarn test:mutation`
- `yarn build`
- `yarn build:server`
- `yarn build:prod`

Important command semantics:

- `yarn test:unit` is the direct Jest unit-test command.
- `yarn test` is a repository wrapper. Outside CI it delegates to `yarn test:unit`; when `CI=true` it currently exits early instead of running Jest.
- `yarn build` does not compile the server. Use `yarn build:server` for the server TypeScript compile.

If you want automatic lint fixes:

```bash
yarn lint:fix
```

## Browser-Based Tests

Smoke tests require the application to be running:

```bash
TEST_URL=http://localhost:3100 yarn test:smoke
```

Functional tests:

```bash
TEST_URL=http://localhost:3100 yarn test:functional
```

Accessibility tests:

```bash
AUTH_ENABLED=false TEST_URL=http://localhost:3100 yarn test:a11y
```

If authentication is enabled, provide IDAM credentials so Playwright can log in and cache the session:

```bash
TEST_URL=http://localhost:3100 \
TEST_IDAM_USERNAME=caseworker@example.com \
TEST_IDAM_PASSWORD=*** \
yarn test:smoke
```

If Edge is enabled in Playwright projects, install it first:

```bash
yarn setup:edge
```

## Healthcheck

The application exposes a health endpoint at [http://localhost:3100/health](http://localhost:3100/health).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
