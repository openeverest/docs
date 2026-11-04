import fs from 'node:fs';
import path from 'node:path';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type {Options as DocsOptions} from '@docusaurus/plugin-content-docs';
import apiReferencePlugin from './plugins/api-reference';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const GITHUB_REPO = 'https://github.com/openeverest/docs';

/**
 * Released versions are not stored on main. `npm run versions`
 * (scripts/assemble-versions.mjs) extracts them from git tags into
 * versioned_docs/ and writes versions.meta.json, which is read here.
 * Without it, only the "next" docs from main are built.
 */
type VersionMeta = {
  name: string;
  tag: string;
  label: string;
  major: number;
  prerelease: boolean;
};
type VersionsMeta = {lastVersion: string | null; versions: VersionMeta[]};

function loadVersionsMeta(): VersionsMeta {
  const file = path.join(__dirname, 'versions.meta.json');
  if (!fs.existsSync(file)) {
    return {lastVersion: null, versions: []};
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as VersionsMeta;
}

const versionsMeta = loadVersionsMeta();
const lastVersion = versionsMeta.lastVersion ?? 'current';

const versionsConfig: NonNullable<DocsOptions['versions']> = {
  current: {
    label: 'Next',
    path: 'next',
    banner: 'unreleased',
  },
};
for (const v of versionsMeta.versions) {
  if (v.name === lastVersion) {
    versionsConfig[v.name] = {label: `${v.label} (current)`, path: 'current', banner: 'none'};
  } else if (v.prerelease) {
    // Released previews get their own banner from src/theme/DocVersionBanner;
    // Docusaurus' "unreleased" banner is meant for the unreleased "next" docs.
    versionsConfig[v.name] = {label: `${v.label} (preview)`, path: v.name, banner: 'none'};
  } else {
    versionsConfig[v.name] = {label: v.label, path: v.name, banner: 'unmaintained'};
  }
}
const lastVersionPath = lastVersion === 'current' ? 'next' : 'current';

// Pick the branch that "Edit this page" points to for a given version.
function editBranch(versionName: string): string {
  const meta = versionsMeta.versions.find((v) => v.name === versionName);
  return meta && meta.major === 1 ? 'release-1.x' : 'main';
}

const config: Config = {
  title: 'OpenEverest',
  tagline: 'Open source platform for automated database provisioning and management on Kubernetes',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // Served as a GitHub Pages project site of the openeverest org, whose
  // custom domain is openeverest.io, so this repo is published at /docs/.
  url: 'https://openeverest.io',
  baseUrl: '/docs/',

  organizationName: 'openeverest',
  projectName: 'docs',
  // Version names contain dots (1.17, 2.0.0-dev.4), so pages are emitted as
  // <path>/index.html; "<path>.html" would be mistaken for a file extension.
  trailingSlash: true,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',

  customFields: {
    // Version name -> git tag it was built from, e.g. {"1.17": "v1.17.0"}.
    versionTags: Object.fromEntries(versionsMeta.versions.map((v) => [v.name, v.tag])),
    // Released prerelease versions, e.g. ["2.0.0-dev.4"]; shown with the preview banner.
    previewVersions: versionsMeta.versions
      .filter((v) => v.prerelease && v.name !== lastVersion)
      .map((v) => v.name),
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          sidebarPath: './sidebars.json',
          routeBasePath: '/',
          lastVersion,
          versions: versionsConfig,
          editUrl: ({version, versionDocsDirPath, docPath}) => {
            const docsDir = versionDocsDirPath.startsWith('versioned_docs') ? 'docs' : versionDocsDirPath;
            return `${GITHUB_REPO}/edit/${editBranch(version)}/${docsDir}/${docPath}`;
          },
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        gtag: {
          trackingID: 'G-J4J70BNH0G',
          anonymizeIP: true,
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [{from: '/', to: `/${lastVersionPath}/`}],
        // While a version is the latest stable one it is served at /current/;
        // keep its versioned URL (e.g. /1.17/...) working as a redirect.
        createRedirects(existingPath: string) {
          if (lastVersion !== 'current' && existingPath.startsWith('/current/')) {
            return [existingPath.replace(/^\/current\//, `/${lastVersion}/`)];
          }
          return undefined;
        },
      },
    ],
    apiReferencePlugin,
  ],

  themeConfig: {
    image: 'img/hero-image-2x1-ratio.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    navbar: {
      logo: {
        alt: 'OpenEverest',
        src: 'img/logo-horizontal-full-color-dark.svg',
        href: 'https://openeverest.io',
        target: '_self',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {to: '/api/', label: 'API', position: 'left', activeBaseRegex: '/api/'},
        {
          type: 'docsVersionDropdown',
          position: 'right',
          dropdownItemsAfter: [{to: '/versions', label: 'All versions'}],
        },
        {
          href: 'https://openeverest.io/blog',
          label: 'Blog',
          position: 'right',
        },
        {
          href: 'https://github.com/openeverest/openeverest',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      logo: {
        alt: 'OpenEverest',
        src: 'img/logo-horizontal-full-color-dark.svg',
        height: 32,
        href: 'https://openeverest.io',
      },
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Quickstart guide', to: `/${lastVersionPath}/quick-install`},
            {label: 'Release notes', to: `/${lastVersionPath}/release-notes/release_notes_index`},
            {label: 'API reference', to: '/api/'},
            {label: 'All versions', to: '/versions'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: 'https://github.com/openeverest/openeverest'},
            {label: 'Community', href: 'https://openeverest.io/community/'},
            {label: 'Contribute to docs', href: GITHUB_REPO},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'OpenEverest', href: 'https://openeverest.io'},
            {label: 'Blog', href: 'https://openeverest.io/blog'},
          ],
        },
      ],
      copyright: `The OpenEverest Contributors © ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'sql', 'docker'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
