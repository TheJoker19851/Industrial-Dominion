export type SupportedLocale = 'en' | 'fr';

export const starterRegionIds = [
  'ironridge',
  'greenhaven',
  'sunbarrel',
  'riverplain',
] as const;
export type RegionId = (typeof starterRegionIds)[number];

export type ResourceId =
  | 'iron_ore'
  | 'iron_ingot'
  | 'coal'
  | 'wood'
  | 'crude_oil'
  | 'sand'
  | 'water'
  | 'crops';

export const starterResourceIds = [
  'iron_ore',
  'coal',
  'wood',
  'crude_oil',
  'sand',
  'water',
  'crops',
] as const satisfies readonly ResourceId[];

export type ResourceCategory =
  | 'raw'
  | 'processed'
  | 'component'
  | 'finished'
  | 'energy';

export type BuildingCategory =
  | 'extraction'
  | 'processing'
  | 'energy'
  | 'storage'
  | 'logistics'
  | 'advanced';

export type EventScope = 'global' | 'regional';
export type EventPolarity = 'positive' | 'neutral' | 'negative';

export type LedgerActionType =
  | 'starter_grant'
  | 'build'
  | 'upgrade'
  | 'production_transform_started'
  | 'production_completed'
  | 'claim_production'
  | 'market_purchase'
  | 'market_sell'
  | 'market_fee'
  | 'maintenance';

export type StarterTutorialActionStepId =
  | 'welcome'
  | 'place_extractor'
  | 'claim_production'
  | 'view_inventory'
  | 'sell_resource';

export type StarterTutorialStepId =
  | StarterTutorialActionStepId
  | 'complete';

export interface PlayerProfile {
  id: string;
  locale: SupportedLocale;
  credits: number;
  regionId?: RegionId;
}

export interface PlayerSettings {
  playerId: string;
  locale: SupportedLocale;
  mobileNotificationsEnabled: boolean;
}

export interface Region {
  id: RegionId;
  nameKey: string;
  descriptionKey: string;
}

export interface ResourceDefinition {
  id: ResourceId;
  nameKey: string;
  category: ResourceCategory;
  tier: number;
  basePrice: number;
  tradable: boolean;
  storable: boolean;
}

export interface BuildingTypeDefinition {
  id: string;
  nameKey: string;
  category: BuildingCategory;
}

export interface ProductionTransformRecipeDefinition {
  id: string;
  buildingTypeId: string;
  nameKey: string;
  descriptionKey: string;
  inputResourceId: ResourceId;
  inputAmount: number;
  outputResourceId: ResourceId;
  outputAmount: number;
  durationSeconds: number;
}

export interface StarterExtractorDefinition extends BuildingTypeDefinition {
  descriptionKey: string;
  outputResourceId: ResourceId;
  baseOutputPerHour: number;
  baseMaintenancePerHour: number;
  baseEnergyUsePerMinute: number;
  allowedRegionIds: readonly RegionId[];
}

export interface Building {
  id: string;
  playerId: string;
  regionId: RegionId;
  buildingTypeId: string;
  level: number;
}

export interface InventoryEntry {
  playerId: string;
  resourceId: ResourceId;
  quantity: number;
}

export interface DashboardExtractorSummary {
  buildingId: string;
  buildingTypeId: string;
  level: number;
  outputResourceId: ResourceId;
  outputPerHour: number;
  claimableQuantity: number;
  readyToClaim: boolean;
  nextClaimAt: string;
}

export interface DashboardSnapshot {
  player: PlayerProfile | null;
  inventory: InventoryEntry[];
  extractor: DashboardExtractorSummary | null;
  transformRecipes: DashboardTransformRecipeSummary[];
  ledger: LedgerFeedEntry[];
  news: NewsFeedItem[];
}

export interface DashboardTransformJobSummary {
  jobId: string;
  recipeId: string;
  buildingId: string;
  completesAt: string;
  readyToClaim: boolean;
}

export interface DashboardTransformRecipeSummary {
  recipeId: string;
  buildingId: string;
  nameKey: string;
  descriptionKey: string;
  inputResourceId: ResourceId;
  inputAmount: number;
  outputResourceId: ResourceId;
  outputAmount: number;
  durationSeconds: number;
  canStart: boolean;
  missingInputAmount: number;
  activeJob: DashboardTransformJobSummary | null;
}

export interface MarketInventoryItem {
  resourceId: ResourceId;
  quantity: number;
  basePrice: number;
  grossValue: number;
  feeAmount: number;
  netValue: number;
}

export interface MarketOfferItem {
  resourceId: ResourceId;
  basePrice: number;
}

export interface MarketSnapshot {
  player: PlayerProfile | null;
  marketFeeRate: number;
  offers: MarketOfferItem[];
  inventory: MarketInventoryItem[];
}

export interface MarketSellResult {
  playerCredits: number;
  resourceId: ResourceId;
  quantitySold: number;
  inventoryQuantity: number;
  pricePerUnit: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  orderId: string;
}

export interface MarketBuyResult {
  playerCredits: number;
  resourceId: ResourceId;
  quantityPurchased: number;
  inventoryQuantity: number;
  pricePerUnit: number;
  totalCost: number;
  orderId: string;
}

export interface TransformStartResult {
  jobId: string;
  buildingId: string;
  recipeId: string;
  inputResourceId: ResourceId;
  inputInventoryQuantity: number;
  outputResourceId: ResourceId;
  outputAmount: number;
  completesAt: string;
}

export interface TransformClaimResult {
  jobId: string;
  buildingId: string;
  recipeId: string;
  outputResourceId: ResourceId;
  outputAmount: number;
  inventoryQuantity: number;
  claimedAt: string;
}

export interface WorldEvent {
  id: string;
  headlineKey: string;
  bodyKey: string;
  scope: EventScope;
  polarity: EventPolarity;
}

export interface NewsFeedItem {
  id: string;
  headlineKey: string;
  bodyKey: string;
  scope: 'system' | 'global' | 'regional' | 'corporation';
  createdAt: string;
}

export interface NewsFeedSnapshot {
  items: NewsFeedItem[];
}

export interface LedgerEntry {
  id: string;
  playerId: string;
  actionType: LedgerActionType;
  amount: number;
  resourceId?: ResourceId;
}

export interface LedgerFeedEntry {
  id: string;
  actionType: LedgerActionType;
  amount: number;
  resourceId?: ResourceId;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface LedgerFeedSnapshot {
  entries: LedgerFeedEntry[];
}

export interface StarterTutorialStepDefinition {
  id: StarterTutorialStepId;
  titleKey: string;
  descriptionKey: string;
  objectiveKey: string;
}

export interface StarterTutorialStepState extends StarterTutorialStepDefinition {
  completed: boolean;
}

export interface StarterTutorialProgress {
  tutorialId: 'starter_loop';
  currentStepId: StarterTutorialStepId;
  currentStepIndex: number;
  totalSteps: number;
  isSkipped: boolean;
  isCompleted: boolean;
  completedStepIds: StarterTutorialActionStepId[];
  steps: StarterTutorialStepState[];
}
