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

For SSO users, the IdP issues and controls the tokens. OpenEverest validates them on every request, and they stop working when the user logs out of OpenEverest. A token of a user who was removed from the IdP stays valid until it expires, so configure short-lived access tokens in the IdP:

- short-lived access tokens, for example 5 minutes;
- long-lived refresh tokens.

See the [Okta guide](https://developer.okta.com/docs/guides/refresh-tokens/main/) on refresh tokens for an example.

## Login rate limiting

To slow down password guessing, OpenEverest limits the number of failed login attempts. See [API rate limiting](../use/API_rate_limit.md).
