import type {
  DashboardSnapshot,
  LedgerFeedEntry,
  MarketSnapshot,
  NewsFeedItem,
  StarterTutorialProgress,
} from '@industrial-dominion/shared';

const previewLedgerEntries: LedgerFeedEntry[] = [
  {
    id: 'preview-ledger-1',
    actionType: 'market_sell',
    amount: 540,
    resourceId: 'iron_ingot',
    createdAt: '2026-03-18T12:20:00.000Z',
    metadata: {},
  },
  {
    id: 'preview-ledger-2',
    actionType: 'production_completed',
    amount: 12,
    resourceId: 'iron_ingot',
    createdAt: '2026-03-18T11:55:00.000Z',
    metadata: {},
  },
  {
    id: 'preview-ledger-3',
    actionType: 'claim_production',
    amount: 36,
    resourceId: 'iron_ore',
    createdAt: '2026-03-18T11:32:00.000Z',
    metadata: {},
  },
  {
    id: 'preview-ledger-4',
    actionType: 'logistics_transfer_in',
    amount: 18,
    resourceId: 'coal',
    createdAt: '2026-03-18T11:10:00.000Z',
    metadata: {},
  },
];

const previewNewsItems: NewsFeedItem[] = [
  {
    id: 'preview-news-1',
    headlineKey: 'news.system.startup.headline',
    bodyKey: 'news.system.startup.body',
    scope: 'system',
    createdAt: '2026-03-18T10:00:00.000Z',
  },
  {
    id: 'preview-news-2',
    headlineKey: 'news.system.market.headline',
    bodyKey: 'news.system.market.body',
    scope: 'system',
    createdAt: '2026-03-18T08:45:00.000Z',
  },
];

export const previewDashboardSnapshot: DashboardSnapshot = {
  player: {
    id: 'preview-operator',
    locale: 'en',
    credits: 2840,
    regionId: 'ironridge',
  },
  inventory: [
    { playerId: 'preview-operator', resourceId: 'iron_ore', quantity: 84 },
    { playerId: 'preview-operator', resourceId: 'iron_ingot', quantity: 21 },
    { playerId: 'preview-operator', resourceId: 'coal', quantity: 48 },
    { playerId: 'preview-operator', resourceId: 'wood', quantity: 30 },
    { playerId: 'preview-operator', resourceId: 'water', quantity: 40 },
    { playerId: 'preview-operator', resourceId: 'crops', quantity: 18 },
  ],
  extractor: {
    buildingId: 'preview-extractor-1',
    buildingTypeId: 'ironridge_iron_extractor',
    level: 1,
    outputResourceId: 'iron_ore',
    outputPerHour: 24,
    claimableQuantity: 12,
    readyToClaim: true,
    nextClaimAt: '2026-03-18T12:45:00.000Z',
  },
  processingInstallation: {
    buildingId: 'preview-processing-1',
    buildingTypeId: 'starter_processing_installation',
    level: 1,
  },
  transformRecipes: [],
  logisticsLocations: [
    {
      locationId: 'preview-primary-storage',
      key: 'primary_storage',
      nameKey: 'locations.primary_storage.name',
      inventory: [
        { resourceId: 'iron_ore', quantity: 84 },
        { resourceId: 'iron_ingot', quantity: 21 },
        { resourceId: 'coal', quantity: 48 },
        { resourceId: 'water', quantity: 40 },
      ],
    },
    {
      locationId: 'preview-remote-storage',
      key: 'remote_storage',
      nameKey: 'locations.remote_storage.name',
      inventory: [
        { resourceId: 'wood', quantity: 30 },
        { resourceId: 'crops', quantity: 18 },
      ],
    },
  ],
  ledger: previewLedgerEntries,
  news: previewNewsItems,
};

export const previewMarketSnapshot: MarketSnapshot = {
  player: previewDashboardSnapshot.player,
  marketFeeRate: 0.05,
  contexts: [
    {
      key: 'region_anchor',
      labelKey: 'regions.ironridge.name',
      descriptionKey: 'market.contextDescriptions.region_anchor',
      locationId: 'preview-primary-storage',
      locationNameKey: 'locations.primary_storage.name',
      focusResourceId: 'iron_ore',
    },
    {
      key: 'trade_hub',
      labelKey: 'dashboard.network.tradeHubTitle',
      descriptionKey: 'market.contextDescriptions.trade_hub',
      locationId: 'preview-remote-storage',
      locationNameKey: 'locations.remote_storage.name',
      focusResourceId: 'iron_ingot',
    },
  ],
  offers: [
    {
      resourceId: 'iron_ore',
      basePrice: 12,
      contextPrices: [
        { contextKey: 'region_anchor', price: 10, modifierPercent: -0.15 },
        { contextKey: 'trade_hub', price: 13, modifierPercent: 0.08 },
      ],
    },
    {
      resourceId: 'iron_ingot',
      basePrice: 45,
      contextPrices: [
        { contextKey: 'region_anchor', price: 45, modifierPercent: 0 },
        { contextKey: 'trade_hub', price: 50, modifierPercent: 0.1 },
      ],
    },
    {
      resourceId: 'coal',
      basePrice: 9,
      contextPrices: [
        { contextKey: 'region_anchor', price: 9, modifierPercent: 0 },
        { contextKey: 'trade_hub', price: 12, modifierPercent: 0.18 },
      ],
    },
    {
      resourceId: 'wood',
      basePrice: 7,
      contextPrices: [
        { contextKey: 'region_anchor', price: 7, modifierPercent: 0 },
        { contextKey: 'trade_hub', price: 7, modifierPercent: 0 },
      ],
    },
    {
      resourceId: 'water',
      basePrice: 5,
      contextPrices: [
        { contextKey: 'region_anchor', price: 4, modifierPercent: -0.2 },
        { contextKey: 'trade_hub', price: 6, modifierPercent: 0.2 },
      ],
    },
    {
      resourceId: 'crops',
      basePrice: 10,
      contextPrices: [
        { contextKey: 'region_anchor', price: 9, modifierPercent: -0.1 },
        { contextKey: 'trade_hub', price: 12, modifierPercent: 0.2 },
      ],
    },
  ],
  inventory: [
    {
      resourceId: 'iron_ore',
      quantity: 84,
      basePrice: 12,
      effectivePrice: 11,
      grossValue: 924,
      feeAmount: 50,
      netValue: 874,
      marketContextKey: 'region_anchor',
      locationId: 'preview-primary-storage',
      locationNameKey: 'locations.primary_storage.name',
    },
    {
      resourceId: 'iron_ingot',
      quantity: 21,
      basePrice: 45,
      effectivePrice: 50,
      grossValue: 1050,
      feeAmount: 53,
      netValue: 997,
      marketContextKey: 'trade_hub',
      locationId: 'preview-remote-storage',
      locationNameKey: 'locations.remote_storage.name',
    },
    {
      resourceId: 'wood',
      quantity: 30,
      basePrice: 7,
      effectivePrice: 7,
      grossValue: 210,
      feeAmount: 11,
      netValue: 199,
      marketContextKey: 'region_anchor',
      locationId: 'preview-primary-storage',
      locationNameKey: 'locations.primary_storage.name',
    },
    {
      resourceId: 'water',
      quantity: 40,
      basePrice: 5,
      effectivePrice: 4,
      grossValue: 160,
      feeAmount: 8,
      netValue: 152,
      marketContextKey: 'region_anchor',
      locationId: 'preview-primary-storage',
      locationNameKey: 'locations.primary_storage.name',
    },
  ],
  orders: [
    {
      id: 'preview-order-1',
      resourceId: 'iron_ingot',
      side: 'sell',
      pricePerUnit: 48,
      quantity: 10,
      remainingQuantity: 4,
      status: 'open',
      createdAt: '2026-03-18T12:15:00.000Z',
    },
    {
      id: 'preview-order-2',
      resourceId: 'iron_ore',
      side: 'buy',
      pricePerUnit: 11,
      quantity: 30,
      remainingQuantity: 0,
      status: 'filled',
      createdAt: '2026-03-18T11:50:00.000Z',
    },
  ],
};

export const previewTutorialProgress: StarterTutorialProgress = {
  tutorialId: 'starter_loop',
  currentStepId: 'buy_resource',
  currentStepIndex: 5,
  totalSteps: 8,
  isSkipped: false,
  isCompleted: false,
  completedStepIds: [
    'extract_resource',
    'claim_resource',
    'open_inventory',
    'sell_resource',
  ],
  steps: [
    {
      id: 'extract_resource',
      titleKey: 'tutorial.steps.extract_resource.title',
      descriptionKey: 'tutorial.steps.extract_resource.description',
      objectiveKey: 'tutorial.steps.extract_resource.objective',
      completed: true,
    },
    {
      id: 'claim_resource',
      titleKey: 'tutorial.steps.claim_resource.title',
      descriptionKey: 'tutorial.steps.claim_resource.description',
      objectiveKey: 'tutorial.steps.claim_resource.objective',
      completed: true,
    },
    {
      id: 'open_inventory',
      titleKey: 'tutorial.steps.open_inventory.title',
      descriptionKey: 'tutorial.steps.open_inventory.description',
      objectiveKey: 'tutorial.steps.open_inventory.objective',
      completed: true,
    },
    {
      id: 'sell_resource',
      titleKey: 'tutorial.steps.sell_resource.title',
      descriptionKey: 'tutorial.steps.sell_resource.description',
      objectiveKey: 'tutorial.steps.sell_resource.objective',
      completed: true,
    },
    {
      id: 'buy_resource',
      titleKey: 'tutorial.steps.buy_resource.title',
      descriptionKey: 'tutorial.steps.buy_resource.description',
      objectiveKey: 'tutorial.steps.buy_resource.objective',
      completed: false,
    },
    {
      id: 'produce_resource',
      titleKey: 'tutorial.steps.produce_resource.title',
      descriptionKey: 'tutorial.steps.produce_resource.description',
      objectiveKey: 'tutorial.steps.produce_resource.objective',
      completed: false,
    },
    {
      id: 'transfer_resource',
      titleKey: 'tutorial.steps.transfer_resource.title',
      descriptionKey: 'tutorial.steps.transfer_resource.description',
      objectiveKey: 'tutorial.steps.transfer_resource.objective',
      completed: false,
    },
    {
      id: 'complete',
      titleKey: 'tutorial.steps.complete.title',
      descriptionKey: 'tutorial.steps.complete.description',
      objectiveKey: 'tutorial.steps.complete.objective',
      completed: false,
    },
  ],
};
