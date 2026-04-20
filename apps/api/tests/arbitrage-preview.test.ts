import { describe, expect, it } from 'vitest';
import { previewArbitrage } from '../src/modules/logistics/logistics-arbitrage.service';
import { buildArbitrageQuote } from '@industrial-dominion/shared';
import { getMarketContextPrice } from '../src/modules/market/market-context';
import { gameConfig } from '@industrial-dominion/config';
import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

const FEE_RATE = gameConfig.marketFee;

function applySpread(price: number, side: 'buy' | 'sell'): number {
  return Math.max(1, Math.round(price * (side === 'buy' ? 1.05 : 0.95)));
}

function createArbitrageMock(options?: { playerRegionId?: string }) {
  const player = {
    id: 'player-arbitrage',
    locale: 'en' as const,
    credits: 10000,
    region_id: (options?.playerRegionId ?? 'ironridge') as 'ironridge',
  };

  const resources = [
    { id: 'iron_ore', base_price: 18, tradable: true },
    { id: 'iron_ingot', base_price: 42, tradable: true },
    { id: 'coal', base_price: 12, tradable: true },
    { id: 'wood', base_price: 10, tradable: true },
    { id: 'plank', base_price: 26, tradable: true },
    { id: 'crude_oil', base_price: 22, tradable: true },
    { id: 'fuel', base_price: 48, tradable: true },
    { id: 'sand', base_price: 8, tradable: true },
    { id: 'water', base_price: 6, tradable: true },
    { id: 'crops', base_price: 9, tradable: true },
  ];

  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: player, error: null }),
                }),
              }),
            };
          }
          if (table === 'resources') {
            let selectedId = '';
            const q: Record<string, (...args: unknown[]) => unknown> = {
              eq: vi.fn((col: string, val: string) => {
                if (col === 'id') selectedId = val;
                return q;
              }),
              maybeSingle: vi.fn().mockImplementation(() => {
                const r = resources.find((r) => r.id === selectedId);
                return Promise.resolve({ data: r ?? null, error: null });
              }),
            };
            return { select: vi.fn().mockReturnValue(q) };
          }
          throw new Error(`Unexpected table ${table}`);
        },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as FastifyInstance,
  };
}

describe('TASK-056: Arbitrage Preview Integration', () => {
  describe('1. Preview Returns Both Local and Remote', () => {
    it('returns structured arbitrage quote with all fields', async () => {
      const { app } = createArbitrageMock();

      const result = await previewArbitrage(app, {
        playerId: 'player-arbitrage',
        resourceId: 'iron_ore',
        quantity: 50,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });

      expect(result.resource).toBe('iron_ore');
      expect(result.quantity).toBe(50);
      expect(result.originRegion).toBe('ironridge');
      expect(result.destinationRegion).toBe('greenhaven');

      expect(result.local.gross).toBeGreaterThan(0);
      expect(result.local.net).toBeGreaterThan(0);
      expect(typeof result.local.avgPrice).toBe('number');
      expect(typeof result.local.slippageBps).toBe('number');

      expect(result.remote.gross).toBeGreaterThan(0);
      expect(typeof result.remote.avgPrice).toBe('number');
      expect(typeof result.remote.slippageBps).toBe('number');
      expect(result.remote.transportCost).toBeGreaterThan(0);
      expect(result.remote.transportTime).toBeGreaterThan(0);

      expect(typeof result.delta.profitDifference).toBe('number');
      expect(typeof result.delta.isRemoteBetter).toBe('boolean');
    });
  });

  describe('2. Transport Cost Reduces Remote Profitability', () => {
    it('remote net is reduced by transport cost', async () => {
      const { app } = createArbitrageMock();

      const result = await previewArbitrage(app, {
        playerId: 'player-arbitrage',
        resourceId: 'iron_ore',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
      });

      const remoteGrossAfterFee =
        result.remote.gross - Math.round(result.remote.gross * FEE_RATE);
      expect(result.remote.net).toBeLessThan(remoteGrossAfterFee);
      expect(result.remote.net).toBe(
        remoteGrossAfterFee - result.remote.transportCost,
      );
    });
  });

  describe('3. Profitable Arbitrage Scenario', () => {
    it('iron_ingot from ironridge to greenhaven with trade hub premium', async () => {
      const { app } = createArbitrageMock();

      const result = await previewArbitrage(app, {
        playerId: 'player-arbitrage',
        resourceId: 'iron_ingot',
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });

      expect(result.local.gross).toBeGreaterThan(0);
      expect(result.remote.gross).toBeGreaterThan(0);
      expect(result.remote.transportCost).toBeGreaterThan(0);
    });
  });

  describe('4. Unprofitable Arbitrage Scenario', () => {
    it('high volume with high transport cost can make local better', async () => {
      const { app } = createArbitrageMock();

      const result = await previewArbitrage(app, {
        playerId: 'player-arbitrage',
        resourceId: 'sand',
        quantity: 1000,
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
      });

      expect(result.remote.transportCost).toBeGreaterThan(0);
      expect(result.remote.slippageBps).toBeGreaterThan(0);
    });
  });

  describe('5. Consistency with Shared Calculator', () => {
    it('API preview matches direct shared calculation', async () => {
      const { app } = createArbitrageMock();

      const result = await previewArbitrage(app, {
        playerId: 'player-arbitrage',
        resourceId: 'iron_ore',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });

      const originCtx = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'ironridge',
        resourceId: 'iron_ore',
        basePrice: 18,
        side: 'sell',
      });
      const destCtx = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'greenhaven',
        resourceId: 'iron_ore',
        basePrice: 18,
        side: 'sell',
      });

      const direct = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: applySpread(originCtx.price, 'sell'),
        destinationAnchorPrice: applySpread(destCtx.price, 'sell'),
        feeRate: FEE_RATE,
      });

      expect(result).toEqual(direct);
    });
  });

  describe('6. Resource Not Found', () => {
    it('throws for non-existent resource', async () => {
      const { app } = {
        app: {
          getSupabaseAdminClient: () => ({
            from: (table: string) => {
              if (table === 'players') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: 'p1',
                          locale: 'en',
                          credits: 1000,
                          region_id: 'ironridge',
                        },
                        error: null,
                      }),
                    }),
                  }),
                };
              }
              if (table === 'resources') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          }),
        } as unknown as FastifyInstance,
      };

      await expect(
        previewArbitrage(app, {
          playerId: 'p1',
          resourceId: 'iron_ore',
          quantity: 10,
          originRegion: 'ironridge',
          destinationRegion: 'greenhaven',
        }),
      ).rejects.toThrow('Resource not found.');
    });
  });
});
