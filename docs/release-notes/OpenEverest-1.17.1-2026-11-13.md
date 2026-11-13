# What's new in OpenEverest 1.17.1

➡️ **New to OpenEverest?** Get started with our [Quickstart Guide](../quick-install.md).

> ⚠️ **Security release**: This patch fixes [GHSA-qv2p-mv35-wq3m](https://github.com/openeverest/openeverest/security/advisories/GHSA-qv2p-mv35-wq3m), a high-severity authentication bypass in single sign-on (SSO). Every OpenEverest version up to and including 1.17.0 with SSO configured is affected. Upgrade as soon as possible. If you use SSO, read [Before you upgrade: SSO users](#before-you-upgrade-sso-users) first.

---

## 🌟 Release highlights

### SSO accepts only ID tokens issued to OpenEverest

OpenEverest accepted any token that the configured identity provider (IdP) had issued, including tokens issued to *other* applications registered with the same IdP. Anyone holding such a token, for example the operator of another application on the same IdP, could sign in to OpenEverest as that user, with the user's groups and RBAC permissions. The API also accepted IdP-signed JWTs directly as bearer tokens.

OpenEverest now accepts only an OIDC ID token that the IdP issued to the OpenEverest client. The token is validated as [OpenID Connect Core §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation) requires: signature, issuer, audience, authorized party and expiry. It must also have been issued within the last 5 minutes. Access tokens and the IdP's UserInfo endpoint are no longer used, and the API accepts only tokens that OpenEverest issued itself.

### More reliable SSO sessions in the UI

- Reloading the page or opening a new tab after the 15-minute session expired renews the session, instead of leaving the page loading forever.
- When a built-in user's session expires on an SSO-enabled instance, the user is logged out instead of being silently signed in as the IdP user.
- Logging out in one tab logs out the other tabs too, instead of being undone by a silent renewal.

---

## Before you upgrade: SSO users

- **Groups are read from the ID token only.** Group-based RBAC policies no longer see groups that your IdP adds only to the access token or to the UserInfo response. Keycloak (default mapper settings), Microsoft Entra ID, Authentik and the Okta org authorization server already add groups to the ID token. Check Okta custom authorization servers whose `groups` claim is included in the access token only, and Auth0 Actions that set the claim only on the access token. See [IdP groups integration](../administer/Idp_groups_integration.md).
- **ID tokens must be signed with an asymmetric key** (RS\*, PS\*, ES\* or EdDSA). An Authentik provider without a signing key signs with HS256: select a signing key.
- **Microsoft Entra ID needs a tenant-specific issuer URL**, because the ID token's issuer is compared with it. The `<client-id>/.default` scope is no longer needed. See [OpenEverest OIDC configuration for Microsoft Entra](../security/sso_idp_integration.md#openeverest-oidc-configuration-for-microsoft-entra).
- **SSO sessions are renewed with a refresh token, which must come with a new ID token.** Without a refresh token, SSO users are signed out every 15 minutes, as in 1.17.0. With one, the IdP must return a new ID token on refresh, otherwise the user is sent back to the login page once the ID token is more than 5 minutes old. See [Keep SSO users signed in](../security/sso_idp_integration.md#keep-sso-users-signed-in).
- **Scripts that call `POST /v1/session/sso` must send an ID token.** IdP tokens are no longer accepted as API bearer tokens. Sessions open in the UI renew automatically after the upgrade.

---

## 📝 Changes

### Fixed

- [#3609](https://github.com/openeverest/openeverest/pull/3609): SSO accepts only OIDC ID tokens issued to the OpenEverest client, and the API accepts only OpenEverest-issued tokens ([GHSA-qv2p-mv35-wq3m](https://github.com/openeverest/openeverest/security/advisories/GHSA-qv2p-mv35-wq3m)).
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
