# API

Everything you can do in the OpenEverest UI, you can also do with the REST API. The UI itself uses the same API.

## Endpoint

The API is served on the same address as the UI, under `/v1`. For example, with port forwarding:

```sh
kubectl port-forward svc/everest 8080:8080 -n everest-system
```

the API is at `http://localhost:8080/v1`. See [Expose OpenEverest](install/install_everest_helm_charts.md#expose-openeverest) for other options.

Resources are addressed by cluster and namespace. OpenEverest manages one cluster, called `main`:

```text
/v1/clusters/main/providers
/v1/clusters/main/namespaces/{namespace}/instances
/v1/clusters/main/namespaces/{namespace}/instances/{instance}/connection
/v1/clusters/main/namespaces/{namespace}/backups
/v1/clusters/main/namespaces/{namespace}/backup-storages
```

## Authentication

Requests need an access token in the `Authorization` header. For built-in users, get one from the token endpoint with the `password` grant:

```sh
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type": "password", "username": "admin", "password": "<password>"}' \
  | jq -r .access_token)
```

The response also contains a `refresh_token`. Access tokens expire after 15 minutes; exchange the refresh token for a new pair with the `refresh_token` grant:

```sh
curl -s -X POST http://localhost:8080/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type": "refresh_token", "refresh_token": "<refresh token>"}'
```

To log out, revoke the refresh token with `POST /v1/auth/revoke`. For single sign-on users, use the access token issued by your identity provider. See [Sessions and tokens](security/session_management.md).

Then call the API:

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v1/clusters/main/namespaces/demo/instances | jq
```

Every request is checked against [RBAC](administer/rbac.md). `GET /v1/permissions` returns what the current user is allowed to do.

## Rate limits

The API limits the number of requests per second. See [API rate limiting](use/API_rate_limit.md).

## Reference

The full API specification is published as an OpenAPI document in the [openeverest repository](https://github.com/openeverest/openeverest/blob/main/api/openapi/http-api.yaml).
