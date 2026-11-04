import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {
  useDocVersionSuggestions,
  useDocsPreferredVersion,
  useDocsVersion,
} from '@docusaurus/plugin-content-docs/client';
import DocVersionBanner from '@theme-original/DocVersionBanner';
import type DocVersionBannerType from '@theme/DocVersionBanner';
import type {WrapperProps} from '@docusaurus/types';

type Props = WrapperProps<typeof DocVersionBannerType>;

function PreviewVersionBanner({className}: Props): ReactNode {
  const {
    siteConfig: {title: siteTitle},
  } = useDocusaurusContext();
  const versionMetadata = useDocsVersion();
  const {pluginId} = versionMetadata;
  const {savePreferredVersionName} = useDocsPreferredVersion(pluginId);
  const {latestDocSuggestion, latestVersionSuggestion} = useDocVersionSuggestions(pluginId);
  const latestDoc =
    latestDocSuggestion ??
    latestVersionSuggestion.docs.find((doc) => doc.id === latestVersionSuggestion.mainDocId);

  return (
    <div
      className={clsx(
        className,
        ThemeClassNames.docs.docVersionBanner,
        'alert alert--info margin-bottom--md',
      )}
      role="alert">
      <div>
        This is documentation for {siteTitle} <b>{versionMetadata.label}</b>, a Developer Preview
        release. It is not intended for production.
      </div>
      {latestDoc && (
        <div className="margin-top--md">
          For the stable release, see the{' '}
          <b>
            <Link
              to={latestDoc.path}
              onClick={() => savePreferredVersionName(latestVersionSuggestion.name)}>
              latest version
            </Link>
          </b>{' '}
          ({latestVersionSuggestion.name}).
        </div>
      )}
    </div>
  );
}

export default function DocVersionBannerWrapper(props: Props): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const {version} = useDocsVersion();
  const previewVersions = (siteConfig.customFields?.previewVersions ?? []) as string[];

  if (previewVersions.includes(version)) {
    return <PreviewVersionBanner {...props} />;
  }
  return <DocVersionBanner {...props} />;
}
