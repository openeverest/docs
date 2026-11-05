import React, {type ReactNode} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useHistory} from '@docusaurus/router';
import type {ApiReferenceProps} from '../../../plugins/api-reference';
import styles from './styles.module.css';

export default function ApiReference({versions, version, view}: ApiReferenceProps): ReactNode {
  const history = useHistory();
  const apiRoot = useBaseUrl('/api/');
  const viewerUrl = useBaseUrl('/api-viewer.html');
  const current = versions.find((v) => v.name === version) ?? versions[0];
  const specUrl = view === 'crds' && current.crdSpecUrl ? current.crdSpecUrl : current.restSpecUrl;
  const pathFor = (name: string, crds: boolean) => `${apiRoot}${name}/${crds ? 'crds/' : ''}`;
  const title = view === 'crds' ? 'Custom resources' : 'REST API';

  return (
    <Layout title={`${title} ${current.label}`} description="OpenEverest REST API and custom resources reference">
      <div className={styles.toolbar}>
        <h1 className={styles.title}>API reference</h1>
        <label className={styles.picker}>
          Version
          <select
            value={current.name}
            onChange={(e) => {
              const next = versions.find((v) => v.name === e.target.value)!;
              history.push(pathFor(next.name, view === 'crds' && next.crdSpecUrl !== null));
            }}>
            {versions.map((v) => (
              <option key={v.name} value={v.name}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        {current.crdSpecUrl && (
          <nav className={styles.tabs}>
            <Link
              aria-current={view === 'rest' ? 'page' : undefined}
              className={view === 'rest' ? styles.tabActive : styles.tab}
              to={pathFor(current.name, false)}>
              REST API
            </Link>
            <Link
              aria-current={view === 'crds' ? 'page' : undefined}
              className={view === 'crds' ? styles.tabActive : styles.tab}
              to={pathFor(current.name, true)}>
              Custom resources
            </Link>
          </nav>
        )}
        <a className={styles.source} href={specUrl}>
          OpenAPI spec
        </a>
      </div>
      <iframe
        key={specUrl}
        className={styles.viewer}
        title={`OpenEverest ${title} ${current.label}`}
        src={`${viewerUrl}?spec=${encodeURIComponent(specUrl)}`}
      />
    </Layout>
  );
}
