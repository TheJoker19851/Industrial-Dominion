export type SupportedLocale = 'en' | 'fr';
export type PlayerLocationKey = 'primary_storage' | 'remote_storage';

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
  | 'plank'
  | 'crude_oil'
  | 'fuel'
  | 'sand'
  | 'water'
  | 'crops';

export const resourceIds = [
  'iron_ore',
  'iron_ingot',
  'coal',
  'wood',
  'plank',
  'crude_oil',
  'fuel',
  'sand',
  'water',
  'crops',
] as const satisfies readonly ResourceId[];

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
  | 'logistics_transfer_out'
  | 'logistics_transfer_in'
  | 'market_purchase'
  | 'market_sell'
  | 'market_fee'
  | 'maintenance';

export type StarterTutorialActionStepId =
  | 'extract_resource'
  | 'claim_resource'
  | 'open_inventory'
  | 'sell_resource'
  | 'buy_resource'
  | 'produce_resource'
  | 'transfer_resource';

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

export interface ProductionRecipeDefinition {
  key: string;
  nameKey: string;
  descriptionKey: string;
  inputResourceId: ResourceId;
  inputAmount: number;
  outputResourceId: ResourceId;
  outputAmount: number;
}

export interface StarterExtractorDefinition extends BuildingTypeDefinition {
  descriptionKey: string;
  outputResourceId: ResourceId;
  baseOutputPerHour: number;
  baseMaintenancePerHour: number;
  baseEnergyUsePerMinute: number;
  allowedRegionIds: readonly RegionId[];
}

export interface StarterProcessingInstallationDefinition extends BuildingTypeDefinition {
  descriptionKey: string;
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

export interface LocationInventoryEntry {
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

export interface DashboardProcessingInstallationSummary {
  buildingId: string;
  buildingTypeId: string;
  level: number;
}

export interface DashboardSnapshot {
  player: PlayerProfile | null;
  inventory: InventoryEntry[];
  extractor: DashboardExtractorSummary | null;
  processingInstallation: DashboardProcessingInstallationSummary | null;
  transformRecipes: DashboardTransformRecipeSummary[];
  logisticsLocations: DashboardLogisticsLocationSummary[];
  ledger: LedgerFeedEntry[];
  news: NewsFeedItem[];
}

export interface DashboardLogisticsLocationSummary {
  locationId: string;
  key: PlayerLocationKey;
  nameKey: string;
  inventory: LocationInventoryEntry[];
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

export interface SlippageQuote {
  anchorPrice: number;
  effectiveAvgPrice: number;
  totalGross: number;
  slippageBps: number;
  slippagePercent: number;
  side: MarketOrderSide;
}

export interface MarketInventoryItem {
  resourceId: ResourceId;
  quantity: number;
  basePrice: number;
  effectivePrice: number;
  grossValue: number;
  feeAmount: number;
  netValue: number;
  marketContextKey: MarketContextKey;
  locationId: string;
  locationNameKey: string;
  bookComparison?: MarketQuoteComparison;
  slippage?: SlippageQuote;
}

export type MarketContextKey = 'region_anchor' | 'trade_hub';

export interface MarketContextSummary {
  key: MarketContextKey;
  labelKey: string;
  descriptionKey: string;
  locationId: string;
  locationNameKey: string;
  focusResourceId: ResourceId;
}

export interface MarketContextPrice {
  contextKey: MarketContextKey;
  price: number;
  modifierPercent: number;
  bookComparison?: MarketQuoteComparison;
}

export type MarketQuoteComparisonRelation = 'better' | 'worse' | 'equal' | 'unavailable';

export interface MarketQuoteComparison {
  referencePrice: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  relation: MarketQuoteComparisonRelation;
}

export interface MarketTopOfBook {
  bestBid: number | null;
  bestAsk: number | null;
}

export interface MarketOfferItem {
  resourceId: ResourceId;
  basePrice: number;
  contextPrices: MarketContextPrice[];
  topOfBook?: MarketTopOfBook;
}

export type MarketOrderSide = 'buy' | 'sell';
export type MarketOrderStatus = 'open' | 'filled' | 'cancelled';

export interface MarketOrderItem {
  id: string;
  resourceId: ResourceId;
  side: MarketOrderSide;
  pricePerUnit: number;
  quantity: number;
  remainingQuantity: number;
  status: MarketOrderStatus;
  createdAt: string;
}

export interface MarketSnapshot {
  player: PlayerProfile | null;
  marketFeeRate: number;
  contexts: MarketContextSummary[];
  offers: MarketOfferItem[];
  inventory: MarketInventoryItem[];
  orders: MarketOrderItem[];
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
  marketContextKey: MarketContextKey;
  locationId: string;
  slippage?: SlippageQuote;
}

export interface MarketBuyResult {
  playerCredits: number;
  resourceId: ResourceId;
  quantityPurchased: number;
  inventoryQuantity: number;
  pricePerUnit: number;
  totalCost: number;
  orderId: string;
  marketContextKey: MarketContextKey;
  locationId: string;
  slippage?: SlippageQuote;
}

export interface MarketLimitOrderResult {
  orderId: string;
  resourceId: ResourceId;
  side: MarketOrderSide;
  pricePerUnit: number;
  quantity: number;
  remainingQuantity: number;
  status: MarketOrderStatus;
  playerCredits: number;
  inventoryQuantity: number;
  matchedOrderId?: string;
  tradeId?: string;
  createdAt: string;
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

export interface ProductionJobResult {
  jobId: string;
  buildingId: string;
  recipeKey: string;
  runs: number;
  inputResourceId: ResourceId;
  inputAmount: number;
  inputInventoryQuantity: number;
  outputResourceId: ResourceId;
  outputAmount: number;
  outputInventoryQuantity: number;
  completedAt: string;
}

export interface LogisticsTransferResult {
  transferId: string;
  fromLocationId: string;
  toLocationId: string;
  resourceId: ResourceId;
  quantity: number;
  fromInventoryQuantity: number;
  toInventoryQuantity: number;
  createdAt: string;
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
