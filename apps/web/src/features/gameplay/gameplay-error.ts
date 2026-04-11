const gameplayErrorKeyMap = {
  'Missing API base URL environment variable': 'gameplayErrors.missingApiBaseUrl',
  'Player must complete bootstrap before placing an extractor.':
    'gameplayErrors.bootstrapRequired',
  'Player already placed the first extractor.':
    'gameplayErrors.firstExtractorAlreadyPlaced',
  'Starter extractor does not match the player region.':
    'gameplayErrors.extractorRegionMismatch',
  'Unknown starter extractor.': 'gameplayErrors.unknownStarterExtractor',
  'Player must complete bootstrap before placing a processing installation.':
    'gameplayErrors.bootstrapRequired',
  'Player must place the first extractor before placing a processing installation.':
    'gameplayErrors.processingInstallationNeedsExtractor',
  'Player already placed the first processing installation.':
    'gameplayErrors.firstProcessingInstallationAlreadyPlaced',
  'Unknown starter processing installation.':
    'gameplayErrors.unknownStarterProcessingInstallation',
  'Invalid first processing installation payload.':
    'gameplayErrors.invalidFirstProcessingInstallationPayload',
  'Starter extractor not found for player.':
    'gameplayErrors.extractorNotFound',
  'No production is ready to claim yet.':
    'gameplayErrors.productionNotReady',
  'Building is not a starter extractor.':
    'gameplayErrors.invalidStarterExtractor',
  'Invalid bootstrap payload.': 'gameplayErrors.invalidBootstrapPayload',
  'Invalid market buy payload.': 'gameplayErrors.invalidMarketBuyPayload',
  'Invalid market order payload.': 'gameplayErrors.invalidMarketOrderPayload',
  'Invalid market sell payload.': 'gameplayErrors.invalidMarketSellPayload',
  'Invalid logistics transfer payload.': 'gameplayErrors.invalidLogisticsTransferPayload',
  'Invalid production job payload.': 'gameplayErrors.invalidProductionJobPayload',
  'Not enough credits to buy resource.': 'gameplayErrors.notEnoughCredits',
  'Not enough credits to place buy order.': 'gameplayErrors.notEnoughCredits',
  'Not enough inventory to sell.': 'gameplayErrors.notEnoughInventory',
  'Not enough inventory to place sell order.':
    'gameplayErrors.notEnoughInventory',
  'Market order price must be greater than zero.':
    'gameplayErrors.invalidMarketOrderPrice',
  'Market order quantity must be greater than zero.':
    'gameplayErrors.invalidMarketOrderQuantity',
  'Market order side is invalid.': 'gameplayErrors.invalidMarketOrderSide',
  'Not enough input inventory to start production.':
    'gameplayErrors.notEnoughProductionInput',
  'Production recipe not found.': 'gameplayErrors.productionRecipeNotFound',
  'Production structure not found for player.':
    'gameplayErrors.productionStructureNotFound',
  'Starter processing installation required for production.':
    'gameplayErrors.processingInstallationRequiredForProduction',
  'Production runs must be at least 1.':
    'gameplayErrors.invalidProductionRuns',
  'Resource not found.': 'gameplayErrors.resourceNotFound',
  'Resource is not purchasable.': 'gameplayErrors.resourceNotPurchasable',
  'Resource is not tradable.': 'gameplayErrors.resourceNotTradable',
  'Transfer quantity must be greater than zero.':
    'gameplayErrors.invalidTransferQuantity',
  'Transfer source and destination must be different.':
    'gameplayErrors.transferLocationsMustDiffer',
  'Transfer source location not found.':
    'gameplayErrors.transferSourceNotFound',
  'Transfer destination location not found.':
    'gameplayErrors.transferDestinationNotFound',
  'Not enough inventory in the source location.':
    'gameplayErrors.notEnoughTransferInventory',
  'Quantity must be greater than zero.':
    'gameplayErrors.invalidSellQuantity',
} as const;

export function getGameplayErrorKey(message: string) {
  return (
    gameplayErrorKeyMap[message as keyof typeof gameplayErrorKeyMap] ??
    'gameplayErrors.generic'
  );
}
