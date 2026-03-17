# AGENTS.md

## Mission

Build Industrial Dominion, a browser-first multiplayer economic strategy game with:

- deep player-driven economy
- minimal graphics but premium UI
- secure authoritative backend
- multilingual support from day one
- mobile-playable core loops from day one

## Final stack

- React + Vite + TypeScript + Tailwind
- Fastify + TypeScript backend
- Railway hosting target
- Supabase (Postgres, Auth, Realtime, Storage)
- Stripe
- English + French at launch
- Responsive web with mobile support in V1

## Included in V1

- players
- corporations
- private messaging
- corporation chat
- system news feed
- global and regional macroeconomic events
- no individual disasters
- no alliances yet
- i18n-ready architecture
- mobile-playable core gameplay

## Deferred to V2+

- alliances
- diplomacy
- treaties
- forum
- public/regional chat
- espionage
- sabotage
- native mobile app if ever needed

## Explicitly excluded

- individual disasters
- direct random building destruction
- personal bad-luck events targeting one player

## Non-negotiable technical rules

1. No sensitive economic mutation is trusted from the client.
2. Fastify backend is the authoritative game engine.
3. Supabase RLS must be strict even if the backend is trusted.
4. Every important economic action writes a ledger/audit record.
5. No player-facing string is hardcoded directly in components.
6. Every new UI string must exist in both English and French locale files.
7. Canonical gameplay IDs remain language-neutral.
8. Do not bypass migrations with manual production schema edits.
9. Keep dev/staging/prod environments separate.
10. Core gameplay screens must remain usable on phone-sized screens.

## Codex rules

- Read all docs in /docs before coding.
- Work one valid task at a time.
- Prefer small complete vertical slices.
- Do not add new stack choices without instruction.
- Do not move core game logic into the client.
- Do not introduce pay-to-win mechanics.
- Do not build desktop-only critical flows.
