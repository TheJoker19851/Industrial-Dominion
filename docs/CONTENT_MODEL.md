# CONTENT_MODEL.md

## Resource schema

```ts
type Resource = {
  id: string;
  nameKey: string;
  category: 'raw' | 'processed' | 'component' | 'finished' | 'energy';
  tier: number;
  basePrice: number;
  tradable: boolean;
  storable: boolean;
};
```

## BuildingType schema

```ts
type BuildingType = {
  id: string;
  nameKey: string;
  category:
    | 'extraction'
    | 'processing'
    | 'energy'
    | 'storage'
    | 'logistics'
    | 'advanced';
};
```

## Event schema

```ts
type WorldEvent = {
  id: string;
  headlineKey: string;
  bodyKey: string;
  scope: 'global' | 'regional';
  polarity: 'positive' | 'neutral' | 'negative';
};
```
