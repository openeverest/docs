import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {useVersions, useLatestVersion} from '@docusaurus/plugin-content-docs/client';

export default function Versions(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const versionTags = (siteConfig.customFields?.versionTags ?? {}) as Record<string, string>;
  const versions = useVersions();
  const latest = useLatestVersion();
  const next = versions.find((v) => v.name === 'current');
  const released = versions.filter((v) => v.name !== 'current');
  const mainDoc = (v: (typeof versions)[number]) =>
    v.docs.find((d) => d.id === v.mainDocId) ?? v.docs[0];

  return (
    <Layout title="Versions" description="OpenEverest documentation versions">
      <main className="container margin-vert--lg">
        <Heading as="h1">OpenEverest documentation versions</Heading>

        <Heading as="h2">Current stable</Heading>
        <p>
          Documentation for the latest stable release, <b>{latest.label}</b>, is always
          available at <Link to={mainDoc(latest).path}>/docs/current</Link>.
        </p>

        <Heading as="h2">Released versions</Heading>
        <table>
          <tbody>
            {released.map((v) => (
              <tr key={v.name}>
                <th>{v.label}</th>
                <td>
                  <Link to={mainDoc(v).path}>Documentation</Link>
                </td>
                <td>
                  {versionTags[v.name] && (
                    <Link
                      to={`https://github.com/openeverest/openeverest/releases/tag/${versionTags[v.name]}`}>
                      Release {versionTags[v.name]}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {next && (
          <>
            <Heading as="h2">Next (unreleased)</Heading>
            <p>
              Work-in-progress documentation built from the <code>main</code> branch:{' '}
              <Link to={mainDoc(next).path}>{next.label}</Link>.
            </p>
          </>
        )}

        <Heading as="h2">Older versions</Heading>
        <p>
          Documentation for older releases is archived in the{' '}
          <Link to="https://github.com/openeverest/everest-doc/tags">everest-doc repository</Link>.
        </p>
      </main>
    </Layout>
  );
}
