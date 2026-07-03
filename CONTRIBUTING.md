# Contributing to Vote Tracker

Thank you for helping improve Vote Tracker. Contributions can include bug fixes, tests, documentation, performance improvements, Discord interface enhancements, and Top.gg compatibility updates.

## Before you start

- Search existing issues and pull requests.
- Use the bug report form for reproducible defects.
- Use the feature request form before starting a large behavior or API change.
- Report security vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Keep changes focused. Unrelated refactors should use a separate pull request.

## Development setup

Requirements:

- Node.js 18.18.2 or newer
- npm
- Git

Clone and install:

```sh
git clone https://github.com/hasib9797/vote-tracker.git
cd vote-tracker
npm ci
```

Run the complete local validation:

```sh
npm test
npm run check
npm run typecheck
npm audit
```

## Branches

Create a short, descriptive branch:

```sh
git switch -c fix/webhook-signature
```

Suggested prefixes:

- `fix/` for bug fixes
- `feature/` for new features
- `docs/` for documentation
- `test/` for test-only changes
- `chore/` for maintenance

## Coding guidelines

- Preserve CommonJS compatibility.
- Keep Node.js 18.18.2 compatibility unless a major release intentionally changes it.
- Use four spaces in JavaScript files.
- Use semicolons and double quotes in JavaScript.
- Prefer small functions with explicit validation and actionable errors.
- Never log API tokens, webhook secrets, Discord tokens, or statistics auth tokens.
- Preserve Top.gg v0 behavior when changing v1 behavior unless the change is documented as breaking.
- Keep Discord commands opt-in.
- Prevent Discord mentions unless notification behavior is explicitly configured.
- Update `typings.d.ts` whenever the public JavaScript API changes.
- Update `README.md` whenever configuration, behavior, events, or methods change.

## Tests

Every behavior change should include a test in `test/`.

Tests must:

- Use the built-in `node:test` runner.
- Avoid real Discord and Top.gg credentials.
- Mock external APIs.
- Close HTTP servers and timers.
- Cover success and failure behavior where practical.

Run:

```sh
npm test
```

For webhook changes, test signature verification, invalid input, acknowledgement status, normalization, and duplicate handling.

For Discord changes, test the generated embed/component structure and interaction response.

## Documentation

Documentation changes should:

- Use complete, runnable examples.
- Use environment variables for secrets.
- Explain defaults and security implications.
- Avoid claiming support for unpublished or development-only dependency versions.
- Link to official Discord or Top.gg documentation for platform-specific behavior.

## Commit messages

Use a concise imperative summary:

```text
Add vote leaderboard command
Fix v1 signature timestamp validation
Document custom Express integration
```

Add a body when the reason or migration impact is not obvious.

## Pull requests

Before opening a pull request:

1. Rebase or merge the latest default branch.
2. Run all tests and checks.
3. Update types and documentation.
4. Review the diff for secrets and unrelated files.
5. Complete the pull-request template.

A pull request should describe:

- The problem
- The approach
- User-visible changes
- Compatibility or migration impact
- Tests performed

Maintainers may request revisions. Keep review discussions technical and respectful.

## Dependency updates

For dependency pull requests:

- Use stable releases unless the change explicitly evaluates a pre-release.
- Include `package-lock.json`.
- Run `npm audit` and `npm outdated`.
- Check upstream release notes for breaking changes.
- Test Top.gg webhook parsing and Discord message generation.

## Release checklist

Maintainers should:

1. Confirm versioning follows semantic versioning.
2. Run `npm ci`.
3. Run all validation scripts.
4. Run `npm audit`.
5. Run `npm outdated`.
6. Inspect `npm pack --dry-run`.
7. Verify README examples and package exports.
8. Publish from a clean, reviewed commit.

## License

By contributing, you agree that your contribution will be licensed under the project's [MIT License](LICENSE).
