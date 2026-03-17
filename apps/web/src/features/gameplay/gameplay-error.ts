const gameplayErrorKeyMap = {
  'Missing API base URL environment variable': 'gameplayErrors.missingApiBaseUrl',
  'Player must complete bootstrap before placing an extractor.':
    'gameplayErrors.bootstrapRequired',
  'Player already placed the first extractor.':
    'gameplayErrors.firstExtractorAlreadyPlaced',
  'Starter extractor does not match the player region.':
    'gameplayErrors.extractorRegionMismatch',
  'Unknown starter extractor.': 'gameplayErrors.unknownStarterExtractor',
  'Starter extractor not found for player.':
    'gameplayErrors.extractorNotFound',
  'No production is ready to claim yet.':
    'gameplayErrors.productionNotReady',
  'Building is not a starter extractor.':
    'gameplayErrors.invalidStarterExtractor',
  'Invalid bootstrap payload.': 'gameplayErrors.invalidBootstrapPayload',
  'Invalid market buy payload.': 'gameplayErrors.invalidMarketBuyPayload',
  'Invalid market sell payload.': 'gameplayErrors.invalidMarketSellPayload',
  'Not enough credits to buy resource.': 'gameplayErrors.notEnoughCredits',
  'Not enough inventory to sell.': 'gameplayErrors.notEnoughInventory',
  'Resource not found.': 'gameplayErrors.resourceNotFound',
  'Resource is not purchasable.': 'gameplayErrors.resourceNotPurchasable',
  'Resource is not tradable.': 'gameplayErrors.resourceNotTradable',
  'Quantity must be greater than zero.':
    'gameplayErrors.invalidSellQuantity',
} as const;

export function getGameplayErrorKey(message: string) {
  return (
    gameplayErrorKeyMap[message as keyof typeof gameplayErrorKeyMap] ??
    'gameplayErrors.generic'
  );
}
