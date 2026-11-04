// Serves the OpenEverest REST API and CRD reference at /docs/api/.
//
// Routes:
//   /api/                    the API of the version served at /current/
//   /api/<version>/          REST API of a release, e.g. /api/1.17.0/
//   /api/<version>/crds/     custom resources of a 2.x release
//   /api/next/, /api/next/crds/  the main branch
//
// Versions are the docs tags (vX.Y.Z) plus the older releases listed in
// api.config.json. The specs are loaded in the browser from the openeverest
// repository on GitHub, so adding a version only adds a route.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';

const SPEC_BASE = 'https://raw.githubusercontent.com/openeverest/openeverest';
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export type ApiVersion = {
  name: string;
  label: string;
  restSpecUrl: string;
  crdSpecUrl: string | null;
};

export type ApiReferenceProps = {
  versions: ApiVersion[];
  version: string;
  view: 'rest' | 'crds';
};

function compareVersions(a: string, b: string): number {
  const pa = VERSION_RE.exec(a)!;
  const pb = VERSION_RE.exec(b)!;
  for (let i = 1; i <= 3; i++) {
    if (+pa[i] !== +pb[i]) return +pa[i] - +pb[i];
  }
  if (pa[4] === pb[4]) return 0;
  if (pa[4] === undefined) return 1;
  if (pb[4] === undefined) return -1;
  return pa[4].localeCompare(pb[4], 'en', {numeric: true});
}

function specsFor(name: string): Omit<ApiVersion, 'name' | 'label'> {
  if (name === 'next') {
    return {
      restSpecUrl: `${SPEC_BASE}/refs/heads/main/api/openapi/http-api.yaml`,
      crdSpecUrl: `${SPEC_BASE}/refs/heads/main/api/openapi/crds.gen.yaml`,
    };
  }
  const ref = `${SPEC_BASE}/refs/tags/v${name}`;
  if (+VERSION_RE.exec(name)![1] >= 2) {
    return {restSpecUrl: `${ref}/api/openapi/http-api.yaml`, crdSpecUrl: `${ref}/api/openapi/crds.gen.yaml`};
  }
  return {restSpecUrl: `${ref}/docs/spec/openapi.yml`, crdSpecUrl: null};
}

function gitTags(siteDir: string): string[] {
  try {
    return execFileSync('git', ['tag', '--list', 'v*'], {cwd: siteDir, encoding: 'utf8'})
      .split('\n')
      .map((t) => t.trim().replace(/^v/, ''))
      .filter((t) => VERSION_RE.test(t));
  } catch {
    return [];
  }
}

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : fallback;
}

export default function apiReferencePlugin(context: LoadContext): Plugin {
  return {
    name: 'api-reference',
    async contentLoaded({actions}) {
      const {siteDir} = context;
      const config = readJson<{versions?: string[]}>(path.join(siteDir, 'api.config.json'), {});
      const meta = readJson<{lastVersion: string | null; versions: {name: string; tag: string}[]}>(
        path.join(siteDir, 'versions.meta.json'),
        {lastVersion: null, versions: []},
      );

      const releases = [...new Set([...(config.versions ?? []), ...gitTags(siteDir)])]
        .filter((v) => VERSION_RE.test(v))
        .sort((a, b) => compareVersions(b, a));

      const versions: ApiVersion[] = [
        {name: 'next', label: 'Next (main)', ...specsFor('next')},
        ...releases.map((name) => ({name, label: name, ...specsFor(name)})),
      ];

      // /api/ shows the release behind /docs/current/, like the docs do.
      const currentTag = meta.versions.find((v) => v.name === meta.lastVersion)?.tag.replace(/^v/, '');
      const defaultVersion =
        (currentTag && releases.includes(currentTag) && currentTag) ||
        releases.find((v) => !VERSION_RE.exec(v)![4]) ||
        'next';

      const component = '@site/src/components/ApiReference';
      const route = (routePath: string, props: ApiReferenceProps) =>
        actions.addRoute({path: routePath, component, exact: true, props});

      route(`${context.baseUrl}api/`, {versions, version: defaultVersion, view: 'rest'});
      for (const v of versions) {
        route(`${context.baseUrl}api/${v.name}/`, {versions, version: v.name, view: 'rest'});
        if (v.crdSpecUrl) {
          route(`${context.baseUrl}api/${v.name}/crds/`, {versions, version: v.name, view: 'crds'});
        }
      }
    },
  };
}
