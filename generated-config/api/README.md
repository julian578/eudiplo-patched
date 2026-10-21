# API examples

Set `EUDIPLO_URL`, `TOKEN`, and `TENANT` in your shell. Use an API client limited to the required issuer/verifier roles. These examples intentionally contain placeholders, not usable secrets.

```bash
export EUDIPLO_URL="https://issuer.example.com"
export CLIENT_ID="REPLACE_WITH_TENANT_API_CLIENT_ID"
export CLIENT_SECRET="REPLACE_WITH_TENANT_API_CLIENT_SECRET"
export TENANT="REPLACE_WITH_TENANT_ID"
export TOKEN="$(curl -fsS -X POST "$EUDIPLO_URL/api/oauth2/token" \
  -d grant_type=client_credentials \
  -d client_id="$CLIENT_ID" \
  -d client_secret="$CLIENT_SECRET" | jq -r .access_token)"
```

Create a tenant-scoped API client with `issuance:manage`, `issuance:offer`, `presentation:manage`, `presentation:request`, and `sessions:read` as needed. Split these roles across clients in production if the backend components have different responsibilities. `TENANT` identifies the issuer URL segment and the tenant-bound API client; these management API paths take the tenant from the token, so the tenant ID does not appear in the paths below.

Set issuer behavior (especially batch size 1 and DPoP):

```bash
curl -X POST "$EUDIPLO_URL/api/issuer/config" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data @generated-config/api/issuer-settings.json
```

Create the owner enrollment offer after your backend has verified the PID presentation:

```bash
curl -X POST "$EUDIPLO_URL/api/issuer/offer" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data @generated-config/api/credential-offer-delegation-auth.json
```

At offer creation, populate `jti`, `nbf`, and pseudonymous `owner_id` from your backend. `enrollment.basis` is the static `pid_verified` default. EUDIPLO creates `iss`, `iat`, `exp`, `vct`, `cnf`, and status-list claims itself.

Create an agent offer only after the owner's signed authorization presentation has been verified and stored:

```bash
curl -X POST "$EUDIPLO_URL/api/issuer/offer" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data @generated-config/api/credential-offer-agent-delegation.json
```

The JSON contains per-offer claim values. `agent_key_thumbprint` is deliberately not sent as an unsupported offer property. Store it in your backend alongside the opaque `reference`; issuance needs the patch described in `../NOTES.md` to enforce it against the proof JWK. Without that patch, do not treat the issued agent credential as proof of the particular key your backend selected.

Create the owner's authorization presentation request. The requested type in the project example is `agent_delegation`:

```bash
curl -X POST "$EUDIPLO_URL/api/verifier/offer" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data @generated-config/api/presentation-request-delegation.json
```

Earlier wallet-prototype instructions said Paradym recognizes the exact type `urn:example:agent-delegation:1`. For that wallet build, send `presentation-request-delegation-paradym.json` instead. The request's transaction data type must exactly match the wallet's allowlist.

Save the returned `session`. Open `uri` on the wallet device; render `crossDeviceUri` as a QR code for another device. `credential_ids` must refer to the DCQL query ID. This configuration uses the query ID `credential_1` from the wallet test. It is not a persistent wallet credential identifier.

Poll the result (the session is completed only after the signed request has been verified):

```bash
curl "$EUDIPLO_URL/api/session/$SESSION" \
  -H "Authorization: Bearer $TOKEN"
```

The completed session exposes verified disclosed claims and the outcome. The inline webhook above additionally requests the raw presented token including the SD-JWT disclosures and key-binding JWT. Raw tokens are sensitive: deliver the webhook to a backend, not a browser. Fetch failures from the same session endpoint; `failureCode`, `errorReason` and `outcome` describe the reason. Transaction-data hash mismatch is a presentation validation failure, not a successful authorization.
