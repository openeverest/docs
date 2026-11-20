# Sessions and tokens

## Authentication methods

OpenEverest supports two ways to log in:

- **Built-in users**, managed in OpenEverest. Suitable for small teams and non-production environments. See [Users](../administer/manage_users.md).
- **Single sign-on** with an OpenID Connect identity provider (IdP), such as Okta or Microsoft Entra. Recommended for production. See [Single sign-on](sso_idp_integration.md).

## Built-in users

When a built-in user logs in, OpenEverest issues two tokens:

- An **access token** — a signed JWT that authorizes API requests. It is valid for **15 minutes**.
- A **refresh token** — used to get a new access token without logging in again. It is valid for **30 days** and is replaced every time it is used.

The UI refreshes the access token automatically and keeps the refresh token in an `HttpOnly` cookie, so scripts in the browser can't read it. API clients get both tokens from `POST /v1/auth/token` — see [API](../API.md#authentication).

Tokens stop working when:

- the user logs out (the refresh token is revoked);
- the user's password changes;
- the user is deleted or disabled;
- an administrator resets the signing keys with `everestctl accounts reset-jwt-keys`, which signs out every built-in user.

To change the token lifetimes, set the `ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL` environment variables of the server, for example in your Helm values:

```yaml
server:
  env:
    - name: ACCESS_TOKEN_TTL
      value: 10m
    - name: REFRESH_TOKEN_TTL
      value: 168h
```

## Single sign-on users

When an SSO user signs in, the UI exchanges the ID token from the IdP for an OpenEverest **access token**, valid for **15 minutes** like the access tokens of built-in users (`ACCESS_TOKEN_TTL`). SSO users get no OpenEverest refresh token. Instead, the UI renews the session with the IdP in the background and exchanges the new ID token again. See [Keep SSO users signed in](sso_idp_integration.md#keep-sso-users-signed-in).

Because each renewal goes through the IdP, the IdP stays in control. A user who is disabled or removed in the IdP can't renew, and loses access when the current access token expires. OpenEverest only exchanges ID tokens issued in the last 5 minutes, so a captured ID token can't be used later.

The API accepts only access tokens issued by OpenEverest. Scripts that act as an SSO user must exchange an ID token first; see [API](../API.md#single-sign-on-users).

## Login rate limiting

To slow down password guessing, OpenEverest limits the number of failed login attempts. See [API rate limiting](../use/API_rate_limit.md).
