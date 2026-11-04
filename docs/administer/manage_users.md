# Users

OpenEverest has two kinds of users:

- **Built-in users**, stored in the `everest-accounts` Secret in the `everest-system` namespace. Installation creates the `admin` user.
- **Single sign-on users** from an OpenID Connect identity provider. They are managed in the identity provider, not in OpenEverest. See [Single sign-on](../security/sso_idp_integration.md).

What a user can do is decided by [role-based access control](rbac.md). Built-in users and SSO users are treated the same way.

:::note

This page is about the users who log in to OpenEverest. To manage the users *inside* your databases, use the connection credentials of each instance (see [Connect to an instance](../use/connect.md)) or look for a user-management plugin in the [Plugin Hub](../extend/hub.md).

:::

## Manage built-in users with everestctl

`everestctl accounts` manages built-in users directly through your kubeconfig. It stores passwords as salted hashes.

:::note

`everestctl` is not published as a binary for the OpenEverest 2 Developer Preview. Build it from source with `make build-cli` on the release tag of the [openeverest repository](https://github.com/openeverest/openeverest). The `accounts` commands work with OpenEverest 2. Don't use the commands that install components — `install`, `uninstall`, `upgrade` and `namespaces` — they still target OpenEverest 1.x.

:::

| Task | Command |
| --- | --- |
| Show the initial `admin` password | `everestctl accounts initial-admin-password` |
| List users | `everestctl accounts list` |
| Create a user | `everestctl accounts create --username alice --password "$PASSWORD"` |
| Change a password | `everestctl accounts set-password --username alice --new-password "$PASSWORD"` |
| Delete a user | `everestctl accounts delete --username alice` |
| Sign out all users | `everestctl accounts reset-jwt-keys` |

Omit `--password` to be prompted for it instead.

New users can log in but have no permissions until you grant them a role. See [RBAC](rbac.md).

## Change the admin password without everestctl

The initial `admin` password is stored in plain text and marked as such with an annotation on the Secret. You can replace it with `kubectl` and `yq`:

```sh
kubectl get secret everest-accounts -n everest-system -o yaml | \
  yq '.data."users.yaml" |= (@base64d | from_yaml | .admin.passwordHash = "<NEW_PASSWORD>" | to_yaml | @base64)' | \
  kubectl apply -f -
```

The new password is also stored in plain text. Use `everestctl accounts set-password` to store it as a hash, or switch to [single sign-on](../security/sso_idp_integration.md) and disable the `admin` user.

## How built-in users are stored

The `users.yaml` key of the `everest-accounts` Secret holds one entry per user:

```yaml
admin:
  enabled: true
  capabilities:
    - login
  passwordHash: <hash>
  passwordMtime: "2026-11-04T09:30:00Z"
```

- `enabled: false` blocks the user from logging in.
- `capabilities` lists what the account can be used for. `login` allows logging in to the UI and getting API tokens.
- Changing a password updates `passwordMtime`, which invalidates the user's existing sessions.

## Sessions

Logging in issues a short-lived access token and a refresh token. See [Sessions and tokens](../security/session_management.md).
