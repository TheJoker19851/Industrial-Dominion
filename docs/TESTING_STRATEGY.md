# TESTING_STRATEGY.md

## Required layers

1. unit tests
2. integration tests
3. database-policy tests
4. end-to-end smoke flows
5. responsive/mobile UI checks

## Unit tests

- production math
- maintenance math
- energy use
- event weighting
- macro indicator calculations
- localization helpers
- currency/date formatting wrappers

## Integration tests

- build building
- claim production
- sell resource
- create/accept contract
- corporation membership flows
- message permissions

## Security tests

- unauthorized player cannot mutate another player state
- RLS blocks invalid direct access
- duplicate claims are rejected
- duplicate webhook handling is safe

## E2E starter flow

- sign up
- choose region
- place first extractor
- claim output
- sell output
- see news feed
- switch language
- perform core loop on mobile viewport
