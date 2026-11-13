# What's new in OpenEverest 1.17.1

➡️ **New to OpenEverest?** Get started with our [Quickstart Guide](../quick-install.md).

> ⚠️ **Security release**: This patch fixes [GHSA-qv2p-mv35-wq3m](https://github.com/openeverest/openeverest/security/advisories/GHSA-qv2p-mv35-wq3m), a high-severity authentication bypass in single sign-on (SSO). Every OpenEverest version up to and including 1.17.0 with SSO configured is affected. Upgrade as soon as possible. If you use SSO, read [Before you upgrade: SSO users](#before-you-upgrade-sso-users) first.

---

## 🌟 Release highlights

### SSO accepts only tokens issued to OpenEverest

OpenEverest accepted tokens that your identity provider (IdP) had issued to *other* applications, so anyone holding such a token could sign in to OpenEverest as that user, with the user's groups and permissions. OpenEverest now accepts only ID tokens issued to its own OIDC client. See the [advisory](https://github.com/openeverest/openeverest/security/advisories/GHSA-qv2p-mv35-wq3m) for details.

### More reliable SSO sessions in the UI

- Reloading the page or opening a new tab after the 15-minute session expired renews the session, instead of leaving the page loading forever.
- When a built-in user's session expires on an SSO-enabled instance, the user is logged out instead of being silently signed in as the IdP user.
- Logging out in one tab logs out the other tabs too, instead of being undone by a silent renewal.

---

## Before you upgrade: SSO users

- **Groups must be in the ID token.** If your IdP adds the `groups` claim only to the access token, for example an Okta custom authorization server or an Auth0 Action, add it to the ID token too. See [IdP groups integration](../administer/Idp_groups_integration.md).
- **The IdP must sign ID tokens with an asymmetric key**, such as RS256. In Authentik, select a signing key for the provider.
- **Microsoft Entra ID needs a tenant-specific issuer URL.** See [OpenEverest OIDC configuration for Microsoft Entra](../security/sso_idp_integration.md#openeverest-oidc-configuration-for-microsoft-entra).
- **Use refresh tokens to keep SSO users signed in.** Without them, SSO users are signed out every 15 minutes, as in 1.17.0. See [Keep SSO users signed in](../security/sso_idp_integration.md#keep-sso-users-signed-in).
- **Scripts that call `POST /v1/session/sso` must send an ID token** instead of an access token. IdP tokens are no longer accepted directly by the API.

---

## 📝 Changes

### Fixed

- [#3609](https://github.com/openeverest/openeverest/pull/3609): SSO accepts only ID tokens issued to OpenEverest ([GHSA-qv2p-mv35-wq3m](https://github.com/openeverest/openeverest/security/advisories/GHSA-qv2p-mv35-wq3m)).
- [#3365](https://github.com/openeverest/openeverest/pull/3365): Expired SSO sessions are renewed on page load, an expired built-in session is logged out instead of being renewed through the IdP, and a logout in one tab is no longer undone by another tab.

---

## 🚀 Upgrade to OpenEverest 1.17.1

### Using everestctl

```sh
everestctl upgrade
```

### Using Helm directly

Start with an update of Custom Resource Definitions (CRDs):
```sh
helm repo update
helm upgrade --install everest-crds \
    openeverest/everest-crds \
    --namespace everest-system \
    --take-ownership \
    --version 1.17.1
```

Update OpenEverest itself:

```sh
helm upgrade <RELEASE_NAME> openeverest/openeverest \
    --namespace everest-system \
    --version 1.17.1
```

`<RELEASE_NAME>` is the name of your OpenEverest release: `everest-system` if you installed with `everestctl`. Run `helm list -n everest-system` to check. To upgrade your database namespaces as well, see [Upgrade OpenEverest using Helm](../upgrade/upgrade_with_helm.md).

---

**Full Changelog**: https://github.com/openeverest/openeverest/compare/v1.17.0...v1.17.1
