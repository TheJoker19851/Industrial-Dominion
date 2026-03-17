# SECURITY_RULES.md

## Security goal

Make exploitation difficult by design.
There is no perfect security, but the system must assume hostile clients.

## Core rules

1. Never trust the client for economic outcomes.
2. Every important economic action must be re-calculated on the backend.
3. All critical writes must happen inside server-controlled transactions.
4. RLS must deny direct access by default.
5. Service role or privileged DB access must never be exposed to the client.
6. Rate limit spam-prone endpoints.
7. Keep secrets only in backend or secure environment variables.

## Sensitive actions that MUST go through Fastify

- build building
- upgrade building
- start processing
- claim production
- create market order
- settle market trade
- create contract
- accept contract
- maintenance charge
- event application
- premium entitlement updates
