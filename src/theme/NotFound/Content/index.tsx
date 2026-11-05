import React, {useEffect, useMemo, type ReactNode} from 'react';
import {useHistory, useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAllDocsData} from '@docusaurus/plugin-content-docs/client';
import NotFoundContent from '@theme-original/NotFound/Content';
import type NotFoundContentType from '@theme/NotFound/Content';
import type {WrapperProps} from '@docusaurus/types';
import {findVersionRedirect} from './redirect';

type Props = WrapperProps<typeof NotFoundContentType>;

export default function NotFoundContentWrapper(props: Props): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const {pathname, search, hash} = useLocation();
  const history = useHistory();
  const docsData = useAllDocsData();
  const versions = useMemo(() => Object.values(docsData).flatMap((plugin) => plugin.versions), [docsData]);
  const target = useMemo(() => {
    const path = findVersionRedirect(pathname, siteConfig.baseUrl, versions);
    return path && siteConfig.trailingSlash && !path.endsWith('/') ? `${path}/` : path;
  }, [pathname, siteConfig.baseUrl, siteConfig.trailingSlash, versions]);

  useEffect(() => {
    if (target) {
      history.replace(`${target}${search}${hash}`);
    }
  }, [target, search, hash, history]);

  if (target) {
    return (
      <main className="container margin-vert--xl">
        <p>This version of the documentation is no longer published. Redirecting…</p>
      </main>
    );
  }
  return <NotFoundContent {...props} />;
}
