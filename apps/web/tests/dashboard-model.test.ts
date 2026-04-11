import { describe, expect, it } from 'vitest';
import {
  getDashboardNextActionCue,
  getDashboardStarterProgressSummary,
  getDashboardViewState,
} from '../src/features/dashboard/dashboard-model';

function createReadySnapshot() {
  return {
    player: {
      id: 'player-123',
      locale: 'en' as const,
      credits: 2500,
      regionId: 'ironridge' as const,
    },
    inventory: [],
    extractor: {
      buildingId: 'building-123',
      buildingTypeId: 'ironridge_iron_extractor',
      level: 1,
      outputResourceId: 'iron_ore' as const,
      outputPerHour: 24,
      claimableQuantity: 0,
      readyToClaim: false,
      nextClaimAt: '2026-03-15T13:00:00.000Z',
    },
    processingInstallation: null,
    transformRecipes: [],
    logisticsLocations: [],
    ledger: [],
    news: [],
  };
}

describe('dashboard model helpers', () => {
  it('requires sign-in when no player snapshot exists', () => {
    expect(
      getDashboardViewState({
        isAuthenticated: false,
        snapshot: {
          player: null,
          inventory: [],
          extractor: null,
          processingInstallation: null,
          transformRecipes: [],
          logisticsLocations: [],
          ledger: [],
          news: [],
        },
      }),
    ).toBe('needs_sign_in');
  });

  it('requires bootstrap when the player has no region yet', () => {
    expect(
      getDashboardViewState({
        isAuthenticated: true,
        snapshot: {
          player: {
            id: 'player-123',
            locale: 'en',
            credits: 2500,
          },
          inventory: [],
          extractor: null,
          processingInstallation: null,
          transformRecipes: [],
          logisticsLocations: [],
          ledger: [],
          news: [],
        },
      }),
    ).toBe('needs_bootstrap');
  });

  it('returns ready for a bootstrapped player snapshot', () => {
    expect(
      getDashboardViewState({
        isAuthenticated: true,
        snapshot: {
          player: {
            id: 'player-123',
            locale: 'en',
            credits: 2500,
            regionId: 'ironridge',
          },
          inventory: [],
          extractor: null,
          processingInstallation: null,
          transformRecipes: [],
          logisticsLocations: [],
          ledger: [],
          news: [],
        },
      }),
    ).toBe('ready');
  });

  it('returns null next-action cue when snapshot is unavailable', () => {
    expect(getDashboardNextActionCue(null)).toBeNull();
  });

  it('prioritizes placing extractor when no extractor exists', () => {
    const snapshot = {
      ...createReadySnapshot(),
      extractor: null,
    };

    expect(getDashboardNextActionCue(snapshot)?.key).toBe('place_extractor');
  });

  it('prioritizes claiming extraction when output is ready', () => {
    const snapshot = {
      ...createReadySnapshot(),
      extractor: {
        ...createReadySnapshot().extractor,
        readyToClaim: true,
        claimableQuantity: 24,
      },
    };

    expect(getDashboardNextActionCue(snapshot)?.key).toBe('claim_extraction');
  });

  it('prioritizes placing processing installation after extractor setup', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: null,
    };

    expect(getDashboardNextActionCue(snapshot)?.key).toBe('place_processing');
  });

  it('prioritizes claiming a ready transform batch before starting another run', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: {
        buildingId: 'processor-1',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      transformRecipes: [
        {
          recipeId: 'ironridge_iron_ingot_batch',
          buildingId: 'building-123',
          nameKey: 'transforms.ironridge_iron_ingot_batch.name',
          descriptionKey: 'transforms.ironridge_iron_ingot_batch.description',
          inputResourceId: 'iron_ore' as const,
          inputAmount: 12,
          outputResourceId: 'iron_ingot' as const,
          outputAmount: 6,
          durationSeconds: 3600,
          canStart: true,
          missingInputAmount: 0,
          activeJob: {
            jobId: 'job-1',
            recipeId: 'ironridge_iron_ingot_batch',
            buildingId: 'building-123',
            completesAt: '2026-03-15T13:00:00.000Z',
            readyToClaim: true,
          },
        },
      ],
    };

    expect(getDashboardNextActionCue(snapshot)?.key).toBe('claim_transform');
  });

  it('prioritizes starting transform when processor is placed and recipe can start', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: {
        buildingId: 'processor-1',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      transformRecipes: [
        {
          recipeId: 'ironridge_iron_ingot_batch',
          buildingId: 'building-123',
          nameKey: 'transforms.ironridge_iron_ingot_batch.name',
          descriptionKey: 'transforms.ironridge_iron_ingot_batch.description',
          inputResourceId: 'iron_ore' as const,
          inputAmount: 12,
          outputResourceId: 'iron_ingot' as const,
          outputAmount: 6,
          durationSeconds: 3600,
          canStart: true,
          missingInputAmount: 0,
          activeJob: null,
        },
      ],
    };

    expect(getDashboardNextActionCue(snapshot)?.key).toBe('start_transform');
  });

  it('falls back to a neutral cue when no strong next step is supported', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: {
        buildingId: 'processor-1',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      transformRecipes: [
        {
          recipeId: 'ironridge_iron_ingot_batch',
          buildingId: 'building-123',
          nameKey: 'transforms.ironridge_iron_ingot_batch.name',
          descriptionKey: 'transforms.ironridge_iron_ingot_batch.description',
          inputResourceId: 'iron_ore' as const,
          inputAmount: 12,
          outputResourceId: 'iron_ingot' as const,
          outputAmount: 6,
          durationSeconds: 3600,
          canStart: false,
          missingInputAmount: 3,
          activeJob: null,
        },
      ],
    };

    expect(getDashboardNextActionCue(snapshot)?.key).toBe('fallback');
  });

  it('returns null progress summary when snapshot is unavailable', () => {
    expect(getDashboardStarterProgressSummary(null)).toBeNull();
  });

  it('reports foundation setup when no extractor exists', () => {
    const snapshot = {
      ...createReadySnapshot(),
      extractor: null,
    };

    expect(getDashboardStarterProgressSummary(snapshot)?.key).toBe('setup_foundation');
  });

  it('reports extraction online after extractor placement before first stock', () => {
    const snapshot = {
      ...createReadySnapshot(),
      inventory: [],
      processingInstallation: null,
    };

    expect(getDashboardStarterProgressSummary(snapshot)?.key).toBe('extraction_online');
  });

  it('reports first stock secured when inventory exists before processing setup', () => {
    const snapshot = {
      ...createReadySnapshot(),
      inventory: [
        {
          playerId: 'player-123',
          resourceId: 'iron_ore' as const,
          quantity: 8,
        },
      ],
      processingInstallation: null,
    };

    expect(getDashboardStarterProgressSummary(snapshot)?.key).toBe('first_stock_secured');
  });

  it('reports processing online when processor is placed and no transform run is active', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: {
        buildingId: 'processor-1',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      transformRecipes: [],
    };

    expect(getDashboardStarterProgressSummary(snapshot)?.key).toBe('processing_online');
  });

  it('reports transformation active when a transform job exists', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: {
        buildingId: 'processor-1',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      transformRecipes: [
        {
          recipeId: 'ironridge_iron_ingot_batch',
          buildingId: 'building-123',
          nameKey: 'transforms.ironridge_iron_ingot_batch.name',
          descriptionKey: 'transforms.ironridge_iron_ingot_batch.description',
          inputResourceId: 'iron_ore' as const,
          inputAmount: 12,
          outputResourceId: 'iron_ingot' as const,
          outputAmount: 6,
          durationSeconds: 3600,
          canStart: false,
          missingInputAmount: 0,
          activeJob: {
            jobId: 'job-1',
            recipeId: 'ironridge_iron_ingot_batch',
            buildingId: 'building-123',
            completesAt: '2026-03-15T13:00:00.000Z',
            readyToClaim: false,
          },
        },
      ],
      ledger: [],
    };

    expect(getDashboardStarterProgressSummary(snapshot)?.key).toBe('transformation_active');
  });

  it('reports processed output secured when production completion is visible', () => {
    const snapshot = {
      ...createReadySnapshot(),
      processingInstallation: {
        buildingId: 'processor-1',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      ledger: [
        {
          id: 'ledger-1',
          actionType: 'production_completed' as const,
          amount: 6,
          resourceId: 'iron_ingot' as const,
          createdAt: '2026-03-15T13:30:00.000Z',
          metadata: {},
        },
      ],
    };

    expect(getDashboardStarterProgressSummary(snapshot)?.key).toBe('processed_output_secured');
  });
});
