import React, {type ReactNode} from 'react';
import {matchPath, useLocation} from '@docusaurus/router';
import Layout from '@theme/Layout';
import NotFoundContent from '@theme/NotFound/Content';
import DocsRoot from '@theme-original/DocsRoot';
import type DocsRootType from '@theme/DocsRoot';
import type {WrapperProps} from '@docusaurus/types';

type Props = WrapperProps<typeof DocsRootType>;

// The docs are served at the site root (routeBasePath "/"), so this route
// catches every unknown path, such as an unpublished version. Without a
// matching version it would render an empty page; show the 404 page instead,
// which also redirects unpublished versions.
export default function DocsRootWrapper(props: Props): ReactNode {
  const {pathname} = useLocation();
  const matched = props.route.routes?.some((r) => matchPath(pathname, {path: r.path, exact: r.exact}));
  if (matched) {
    return <DocsRoot {...props} />;
  }
  return (
    <Layout title="Page Not Found">
      <NotFoundContent />
    </Layout>
  );
}
