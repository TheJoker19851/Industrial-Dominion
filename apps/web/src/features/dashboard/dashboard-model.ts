import type { DashboardSnapshot } from '@industrial-dominion/shared';

export type DashboardViewState =
  | 'needs_sign_in'
  | 'needs_bootstrap'
  | 'ready';

export type DashboardNextActionCueKey =
  | 'place_extractor'
  | 'claim_extraction'
  | 'place_processing'
  | 'claim_transform'
  | 'start_transform'
  | 'fallback';

export type DashboardStarterProgressSummaryKey =
  | 'setup_foundation'
  | 'extraction_online'
  | 'first_stock_secured'
  | 'processing_online'
  | 'transformation_active'
  | 'processed_output_secured';

export interface DashboardNextActionCue {
  key: DashboardNextActionCueKey;
  titleKey: string;
  bodyKey: string;
}

export interface DashboardStarterProgressSummary {
  key: DashboardStarterProgressSummaryKey;
  titleKey: string;
  bodyKey: string;
}

export function getDashboardViewState(
  input: {
    isAuthenticated: boolean;
    snapshot: DashboardSnapshot | null;
  },
): DashboardViewState {
  if (!input.isAuthenticated) {
    return 'needs_sign_in';
  }

  if (!input.snapshot?.player?.regionId) {
    return 'needs_bootstrap';
  }

  return 'ready';
}

export function getDashboardNextActionCue(snapshot: DashboardSnapshot | null): DashboardNextActionCue | null {
  if (!snapshot?.player?.regionId) {
    return null;
  }

  if (!snapshot.extractor) {
    return {
      key: 'place_extractor',
      titleKey: 'dashboard.nextActionPlaceExtractorTitle',
      bodyKey: 'dashboard.nextActionPlaceExtractorBody',
    };
  }

  if (snapshot.extractor.readyToClaim) {
    return {
      key: 'claim_extraction',
      titleKey: 'dashboard.nextActionClaimExtractionTitle',
      bodyKey: 'dashboard.nextActionClaimExtractionBody',
    };
  }

  if (!snapshot.processingInstallation) {
    return {
      key: 'place_processing',
      titleKey: 'dashboard.nextActionPlaceProcessingTitle',
      bodyKey: 'dashboard.nextActionPlaceProcessingBody',
    };
  }

  const readyTransformToClaim = snapshot.transformRecipes.find(
    (recipe) => recipe.activeJob?.readyToClaim,
  );

  if (readyTransformToClaim) {
    return {
      key: 'claim_transform',
      titleKey: 'dashboard.nextActionClaimTransformTitle',
      bodyKey: 'dashboard.nextActionClaimTransformBody',
    };
  }

  const startableTransform = snapshot.transformRecipes.find(
    (recipe) => !recipe.activeJob && recipe.canStart,
  );

  if (startableTransform) {
    return {
      key: 'start_transform',
      titleKey: 'dashboard.nextActionStartTransformTitle',
      bodyKey: 'dashboard.nextActionStartTransformBody',
    };
  }

  return {
    key: 'fallback',
    titleKey: 'dashboard.nextActionFallbackTitle',
    bodyKey: 'dashboard.nextActionFallbackBody',
  };
}

export function getDashboardStarterProgressSummary(
  snapshot: DashboardSnapshot | null,
): DashboardStarterProgressSummary | null {
  if (!snapshot?.player?.regionId) {
    return null;
  }

  if (!snapshot.extractor) {
    return {
      key: 'setup_foundation',
      titleKey: 'dashboard.progressSetupFoundationTitle',
      bodyKey: 'dashboard.progressSetupFoundationBody',
    };
  }

  const hasProcessedOutput =
    snapshot.ledger.some((entry) => entry.actionType === 'production_completed') ||
    snapshot.inventory.some((entry) => entry.resourceId === 'iron_ingot' && entry.quantity > 0);

  if (hasProcessedOutput) {
    return {
      key: 'processed_output_secured',
      titleKey: 'dashboard.progressProcessedOutputSecuredTitle',
      bodyKey: 'dashboard.progressProcessedOutputSecuredBody',
    };
  }

  const hasActiveTransform = snapshot.transformRecipes.some((recipe) => recipe.activeJob !== null);

  if (hasActiveTransform) {
    return {
      key: 'transformation_active',
      titleKey: 'dashboard.progressTransformationActiveTitle',
      bodyKey: 'dashboard.progressTransformationActiveBody',
    };
  }

  if (snapshot.processingInstallation) {
    return {
      key: 'processing_online',
      titleKey: 'dashboard.progressProcessingOnlineTitle',
      bodyKey: 'dashboard.progressProcessingOnlineBody',
    };
  }

  const hasInventoryStock = snapshot.inventory.some((entry) => entry.quantity > 0);

  if (hasInventoryStock) {
    return {
      key: 'first_stock_secured',
      titleKey: 'dashboard.progressFirstStockSecuredTitle',
      bodyKey: 'dashboard.progressFirstStockSecuredBody',
    };
  }

  return {
    key: 'extraction_online',
    titleKey: 'dashboard.progressExtractionOnlineTitle',
    bodyKey: 'dashboard.progressExtractionOnlineBody',
  };
}
