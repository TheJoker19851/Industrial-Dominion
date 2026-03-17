import { gameConfig } from '@industrial-dominion/config';
import { createSupabaseAdminClient } from '../../db/client/supabase.js';

export type StarterPackage = {
  credits: number;
  plotCount: number;
  warehouseCount: number;
};

export type StarterPackageGrantResult = {
  starterPackage: StarterPackage;
  alreadyGranted: boolean;
};

export type StarterPackageRepository = {
  grantStarterPackage(
    playerId: string,
    starterPackage: StarterPackage,
  ): Promise<{ alreadyGranted: boolean }>;
};

export function getStarterPackage(): StarterPackage {
  return {
    credits: gameConfig.starterCredits,
    plotCount: gameConfig.starterPlotCount,
    warehouseCount: gameConfig.starterWarehouseCount,
  };
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export function createStarterPackageRepository(
  supabase: Pick<SupabaseAdminClient, 'rpc'>,
): StarterPackageRepository {

  return {
    async grantStarterPackage(playerId, starterPackage) {
      const { data, error } = await supabase.rpc('grant_starter_package', {
        p_player_id: playerId,
        p_credits: starterPackage.credits,
        p_plot_count: starterPackage.plotCount,
        p_warehouse_count: starterPackage.warehouseCount,
      });

      if (error) {
        throw new Error(`Failed to grant starter package: ${error.message}`);
      }

      if (
        !data ||
        typeof data !== 'object' ||
        !('alreadyGranted' in data) ||
        typeof data.alreadyGranted !== 'boolean'
      ) {
        throw new Error('Starter package grant returned an invalid response');
      }

      return { alreadyGranted: data.alreadyGranted };
    },
  };
}

export async function grantStarterPackage(
  playerId: string,
  repository: StarterPackageRepository,
): Promise<StarterPackageGrantResult> {
  const starterPackage = getStarterPackage();
  const { alreadyGranted } = await repository.grantStarterPackage(
    playerId,
    starterPackage,
  );

  return {
    starterPackage,
    alreadyGranted,
  };
}
