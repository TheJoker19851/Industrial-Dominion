import { describe, expect, it, vi } from 'vitest';
import {
  getStarterPackage,
  grantStarterPackage,
  type StarterPackageRepository,
} from '../src/modules/bootstrap/starter-package.service';

function createRepositoryMock(
  overrides: Partial<StarterPackageRepository> = {},
): StarterPackageRepository {
  return {
    grantStarterPackage: vi.fn().mockResolvedValue({ alreadyGranted: false }),
    ...overrides,
  };
}

describe('starter package service', () => {
  it('exposes the configured starter package values', () => {
    expect(getStarterPackage()).toEqual({
      credits: 2500,
      plotCount: 1,
      warehouseCount: 1,
    });
  });

  it('grants the starter package once and records it in the ledger', async () => {
    const repository = createRepositoryMock();

    const result = await grantStarterPackage('player-123', repository);

    expect(result).toEqual({
      starterPackage: {
        credits: 2500,
        plotCount: 1,
        warehouseCount: 1,
      },
      alreadyGranted: false,
    });
    expect(repository.grantStarterPackage).toHaveBeenCalledWith(
      'player-123',
      {
        credits: 2500,
        plotCount: 1,
        warehouseCount: 1,
      },
    );
  });

  it('does not grant the starter package twice', async () => {
    const repository = createRepositoryMock({
      grantStarterPackage: vi.fn().mockResolvedValue({ alreadyGranted: true }),
    });

    const result = await grantStarterPackage('player-123', repository);

    expect(result).toEqual({
      starterPackage: {
        credits: 2500,
        plotCount: 1,
        warehouseCount: 1,
      },
      alreadyGranted: true,
    });
  });
});
