# OpenEverest documentation

Sources of the OpenEverest documentation published at
**[openeverest.io/docs](https://openeverest.io/docs/)**, built with
[Docusaurus](https://docusaurus.io/).

| URL | Content |
| --- | --- |
| `/docs/` | Redirects to `/docs/current/` |
| `/docs/current/` | Latest stable release (for example 1.17) |
| `/docs/<version>/` | A specific release, for example `/docs/1.16/` or `/docs/2.0.0-dev.4/` |
| `/docs/next/` | Unreleased docs from the `main` branch |
| `/docs/versions` | List of all published versions |

The URL of the latest stable version (for example `/docs/1.17/`) redirects to
`/docs/current/`.

## Branches and tags

| Ref | Purpose |
| --- | --- |
| `main` | Docs for the next release (OpenEverest 2.x), plus the site itself: config, theme, scripts, CI. |
| `release-1.x` | Docs for OpenEverest 1.x. |
| `vX.Y.Z` / `vX.Y.Z-pre` tags | Released docs. **Pushing a tag publishes that version.** |

## Local development

Requires Node.js 20+.

```sh
npm ci
npm start            # live preview of docs/ (served as "next")
npm run build:all    # assemble released versions from git tags, then build
npm run serve        # serve the production build at http://localhost:3000/docs/
```

`npm start` only builds the working tree (`docs/`). To preview the whole site
with all versions and the version picker, run `npm run versions` before
`npm start`. Make sure your clone has the tags (`git fetch --tags`).

### With Docker

```sh
docker compose up                    # dev server with live reload
docker compose --profile preview up  # production build of all versions, served by nginx
```

* Dev server: http://localhost:5005/docs/next/ (or `/docs/current/`, `/docs/1.16/`, …).
  It includes all released versions, but redirects such as `/docs/` →
  `/docs/current/` only exist in production builds.
* Preview: http://localhost:5006/docs/. This is the same build that is
  deployed, served like GitHub Pages, so redirects and 404s can be tested.
  Re-run the command to rebuild after changes.

## Versions

Released versions are **not stored on `main`**. `npm run versions`
([scripts/assemble-versions.mjs](scripts/assemble-versions.mjs)) reads the git
tags, selects which ones to publish, and extracts `docs/` and `sidebars.json`
from each selected tag into `versioned_docs/` and `versioned_sidebars/`. These
generated folders are git-ignored.

The selection is configured in [versions.config.json](versions.config.json):

| Setting | Default | Meaning |
| --- | --- | --- |
| `majors` | 2 | Number of newest major lines to publish (for example 1.x and 2.x). |
| `minorsPerMajor` | 3 | Stable minor versions per major. Each is published as `MAJOR.MINOR` from its latest patch tag, so `v1.17.2` becomes version `1.17`. |
| `prereleasesPerMajor` | 2 | Prerelease tags per major that are newer than its latest stable release, for example `2.0.0-dev.4`. They show as *preview* and disappear once a newer stable release is tagged. |
| `include` / `exclude` | `[]` | Tag names to force in or out. |

The newest stable version is served at `/docs/current/`.

## Releasing docs

The deploy workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
runs on every push to `main` and on every `v*` tag.

**A release from `main` (2.x):**

```sh
git checkout main && git pull
git tag -a v2.0.0-dev.5 -m "Docs for OpenEverest 2.0.0-dev.5"
git push origin v2.0.0-dev.5
```

**A 1.x release:** merge the changes into `release-1.x`, then tag that branch:

```sh
git checkout release-1.x && git pull
git tag -a v1.17.1 -m "Docs for OpenEverest 1.17.1"
git push origin v1.17.1
```

**Fixing the docs of a version that is already released:** commit the fix to
the right branch, then move the tag of that release and push it again:

```sh
git tag -fa v1.17.0 -m "Docs for OpenEverest 1.17.0"
git push --force origin v1.17.0
```

## Writing docs

* Pages live in `docs/` as Markdown, compiled as [MDX](https://mdxjs.com/).
  Escape `<` and `{` in text (`&lt;`, `\{`), or put them in `code`.
* The sidebar is defined in [sidebars.json](sidebars.json). It must stay
  JSON, because it is versioned together with `docs/`.
* Use [admonitions](https://docusaurus.io/docs/markdown-features/admonitions)
  (`:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger`),
  [tabs](https://docusaurus.io/docs/markdown-features/tabs) and
  `<details><summary>…</summary>…</details>` for collapsible blocks.
* Link to other pages with relative `.md` paths. The build fails on broken
  links and images.
* Don't use parentheses or spaces in file names. Docusaurus can't route
  paths that contain `(` or `)`.

## Hosting

The site is a GitHub Pages *project site* of the `openeverest` organization.
The organization site ([openeverest/openeverest.github.io](https://github.com/openeverest/openeverest.github.io))
owns the `openeverest.io` custom domain, so this repository is served at
`openeverest.io/docs/`. A project site takes precedence over paths of the same
name in the organization site, so everything under `/docs/` comes from this
repository.

Pages must be enabled in the repository settings with **Source: GitHub
Actions**.

## Migration from everest-doc

The content was migrated from the MkDocs sources in
[openeverest/everest-doc](https://github.com/openeverest/everest-doc) with
[scripts/migration/mkdocs_to_docusaurus.py](scripts/migration/mkdocs_to_docusaurus.py):

```sh
python3 scripts/migration/mkdocs_to_docusaurus.py --src ../everest-doc --out .
```

The script converts admonitions, collapsible blocks, content tabs, icons,
`attr_list`, macros and raw HTML to MDX, generates `sidebars.json` from the
MkDocs `nav`, and repairs or unlinks relative links that point to missing files.
