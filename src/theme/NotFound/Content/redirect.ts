// Decides where to send a request for a docs version that is not published.
//
// Old links can point to versions that were never published on this site
// (e.g. /docs/1.14/...) or that dropped out of the version picker (e.g. an
// older 2.0.0 preview). Those go to the same page in the newest published
// version of the same major, or to that version's start page if the page
// does not exist there. Missing pages in a published version stay 404s.

type Doc = {id: string; path: string};
type Version = {name: string; path: string; isLast: boolean; mainDocId: string; docs: Doc[]};

const VERSION_RE = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/;

const trim = (p: string) => p.replace(/\/+$/, '');

function compare(a: RegExpExecArray, b: RegExpExecArray): number {
  for (let i = 1; i <= 3; i++) {
    const d = +(a[i] ?? 0) - +(b[i] ?? 0);
    if (d !== 0) return d;
  }
  if (a[4] === b[4]) return 0;
  if (a[4] === undefined) return 1;
  if (b[4] === undefined) return -1;
  return a[4].localeCompare(b[4], 'en', {numeric: true});
}

export function findVersionRedirect(pathname: string, baseUrl: string, versions: Version[]): string | null {
  if (!pathname.startsWith(baseUrl)) return null;
  const [first, ...rest] = pathname.slice(baseUrl.length).split('/');
  const requested = VERSION_RE.exec(first ?? '');
  if (!requested) return null;
  if (versions.some((v) => trim(v.path) === trim(baseUrl + first))) return null;

  // "current" is the internal name of the unreleased docs (served at /next/).
  const released = versions
    .map((v) => ({v, m: VERSION_RE.exec(v.name)}))
    .filter((x): x is {v: Version; m: RegExpExecArray} => x.m !== null)
    .sort((a, b) => compare(b.m, a.m));
  const sameMajor = released.filter((x) => x.m[1] === requested[1]);
  const newerMajor = released.length > 0 && +requested[1] > +released[0].m[1];

  const target =
    sameMajor[0]?.v ??
    (newerMajor ? versions.find((v) => v.name === 'current') : undefined) ??
    versions.find((v) => v.isLast) ??
    versions[0];
  if (!target) return null;

  const wanted = trim(`${trim(target.path)}/${rest.join('/')}`);
  const doc = target.docs.find((d) => trim(d.path) === wanted);
  if (doc) return doc.path;
  const main = target.docs.find((d) => d.id === target.mainDocId);
  return main?.path ?? `${trim(target.path)}/`;
}
