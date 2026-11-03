#!/usr/bin/env node
// Assembles released documentation versions from git tags.
//
// main only holds the unreleased ("next") docs. Every release is a git tag
// (vX.Y.Z or vX.Y.Z-pre). This script selects which tags to publish according
// to versions.config.json, extracts docs/ and sidebars.json of each selected
// tag into versioned_docs/ and versioned_sidebars/, and writes versions.json
// (read by Docusaurus) and versions.meta.json (read by docusaurus.config.ts).
//
// Selection, per major line (newest `majors` lines that have tags):
//   - stable: the latest patch of each of the newest `minorsPerMajor` minors,
//     published as "MAJOR.MINOR" (e.g. tag v1.17.2 -> version "1.17");
//   - prerelease: the newest `prereleasesPerMajor` prerelease tags that are
//     newer than the latest stable tag of that major, published under their
//     full name (e.g. "2.0.0-dev.4").
// `include` / `exclude` list tag names to force in or out.
// The newest stable version becomes "current" (served at /docs/current/).

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const config = {
  majors: 2,
  minorsPerMajor: 3,
  prereleasesPerMajor: 2,
  include: [],
  exclude: [],
  ...JSON.parse(fs.readFileSync(path.join(root, 'versions.config.json'), 'utf8')),
};

const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();

const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parse(tag) {
  const m = TAG_RE.exec(tag);
  if (!m) return null;
  return {tag, major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null};
}

function comparePre(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = /^\d+$/.test(pa[i]);
    const nb = /^\d+$/.test(pb[i]);
    if (na && nb && +pa[i] !== +pb[i]) return +pa[i] - +pb[i];
    if (na !== nb) return na ? -1 : 1;
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

function compare(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch || comparePre(a.pre, b.pre);
}

function selectVersions(tags) {
  const parsed = tags.map(parse).filter(Boolean).filter((v) => !config.exclude.includes(v.tag));
  const majors = [...new Set(parsed.map((v) => v.major))].sort((a, b) => b - a).slice(0, config.majors);
  const selected = new Map();

  for (const major of majors) {
    const inMajor = parsed.filter((v) => v.major === major).sort(compare).reverse();
    const stable = inMajor.filter((v) => v.pre === null);
    const latestStable = stable[0];

    const byMinor = new Map();
    for (const v of stable) {
      if (!byMinor.has(v.minor)) byMinor.set(v.minor, v);
    }
    for (const v of [...byMinor.values()].slice(0, config.minorsPerMajor)) {
      selected.set(`${v.major}.${v.minor}`, v);
    }

    inMajor
      .filter((v) => v.pre !== null && (!latestStable || compare(v, latestStable) > 0))
      .slice(0, config.prereleasesPerMajor)
      .forEach((v) => selected.set(v.tag.slice(1), v));
  }

  for (const tag of config.include) {
    const v = parse(tag);
    if (!v) throw new Error(`versions.config.json: invalid tag in include: ${tag}`);
    selected.set(v.pre ? tag.slice(1) : `${v.major}.${v.minor}`, v);
  }

  return [...selected.entries()]
    .map(([name, v]) => ({name, ...v}))
    .sort((a, b) => compare(b, a));
}

function extract(version) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oe-docs-'));
  try {
    const archive = path.join(tmp, 'src.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, version.tag, 'docs', 'sidebars.json'], {
      cwd: root,
    });
    execFileSync('tar', ['-xf', archive, '-C', tmp]);
    fs.cpSync(path.join(tmp, 'docs'), path.join(root, 'versioned_docs', `version-${version.name}`), {recursive: true});
    fs.copyFileSync(
      path.join(tmp, 'sidebars.json'),
      path.join(root, 'versioned_sidebars', `version-${version.name}-sidebars.json`),
    );
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);
const versions = selectVersions(tags);

for (const dir of ['versioned_docs', 'versioned_sidebars']) {
  fs.rmSync(path.join(root, dir), {recursive: true, force: true});
  fs.mkdirSync(path.join(root, dir));
}
versions.forEach(extract);

const lastVersion = versions.find((v) => v.pre === null)?.name ?? null;
fs.writeFileSync(path.join(root, 'versions.json'), JSON.stringify(versions.map((v) => v.name), null, 2) + '\n');
fs.writeFileSync(
  path.join(root, 'versions.meta.json'),
  JSON.stringify(
    {
      lastVersion,
      versions: versions.map((v) => ({
        name: v.name,
        tag: v.tag,
        label: v.name,
        major: v.major,
        prerelease: v.pre !== null,
      })),
    },
    null,
    2,
  ) + '\n',
);

console.log(`Assembled ${versions.length} version(s) from ${tags.length} tag(s):`);
for (const v of versions) {
  const role = v.name === lastVersion ? ' -> /docs/current' : v.pre ? ' (preview)' : '';
  console.log(`  ${v.name.padEnd(14)} from ${v.tag}${role}`);
}
console.log('  next           from working tree (docs/)');
