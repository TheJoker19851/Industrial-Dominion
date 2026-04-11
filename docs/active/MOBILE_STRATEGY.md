# MOBILE_STRATEGY.md

## Goal

V1 must be fully playable on mobile for core gameplay loops.
This is a responsive web strategy, not a native app requirement.

## Core mobile-required flows

- sign in
- choose language
- choose region
- place first extractor
- claim production
- view inventory
- sell resources quickly
- read news feed
- open private messages
- use corporation chat
- basic building management

## Desktop-first but still accessible later

- advanced analytics
- dense order book views
- complex comparison dashboards
- large administrative screens

## Design rules

1. No critical flow should require horizontal scrolling.
2. No critical flow should require hover.
3. Important actions should be reachable with one hand.
4. Tables should collapse into cards/lists on narrow screens.
5. Charts may simplify on mobile.
6. Sidebars should become drawers or tabs.

## Recommended layout strategy

- desktop: multi-panel
- tablet: reduced multi-panel
- phone: tabbed / stacked / sheet-driven

## Testing rule

Every core loop must be tested on mobile viewport before being considered done.
