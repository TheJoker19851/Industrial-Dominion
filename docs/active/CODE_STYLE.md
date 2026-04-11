# CODE_STYLE.md

## General

- TypeScript strict mode
- small modules
- thin route handlers
- service layer for game logic
- repository layer for SQL

## i18n

- no hardcoded player-facing strings in components
- use translation keys

## responsive UI

- do not make core flows depend on hover only
- avoid desktop-only control assumptions
- prefer card/list fallbacks for narrow screens
