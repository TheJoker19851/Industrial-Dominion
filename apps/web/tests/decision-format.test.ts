import { describe, expect, it } from 'vitest';
import {
  getStrategyLabelKey,
  getExplanationKey,
  formatTimeSeconds,
  formatRoi,
  getActionSteps,
} from '../src/features/dashboard/decision-format';
import type { StrategyResult } from '@industrial-dominion/shared';

const stubT = (key: string, params?: Record<string, unknown>) => {
  if (params) return `${key}:${JSON.stringify(params)}`;
  return key;
};

const stubFormatNumber = (v: number) => String(v);

describe('decision-format', () => {
  describe('getStrategyLabelKey', () => {
    it('returns the correct i18n key for each strategy', () => {
      expect(getStrategyLabelKey('SELL_LOCAL')).toBe(
        'dashboard.decisionStrategy.SELL_LOCAL',
      );
      expect(getStrategyLabelKey('PROCESS_AND_SELL_LOCAL')).toBe(
        'dashboard.decisionStrategy.PROCESS_AND_SELL_LOCAL',
      );
      expect(getStrategyLabelKey('TRANSPORT_AND_SELL')).toBe(
        'dashboard.decisionStrategy.TRANSPORT_AND_SELL',
      );
      expect(getStrategyLabelKey('PROCESS_THEN_TRANSPORT_AND_SELL')).toBe(
        'dashboard.decisionStrategy.PROCESS_THEN_TRANSPORT_AND_SELL',
      );
    });
  });

  describe('getExplanationKey', () => {
    it('returns the correct explanation key for each strategy', () => {
      const base = {
        resource: 'iron_ore' as const,
        quantity: 10,
        region: 'ironridge' as const,
        net: 100,
        roi: 0.5,
        time: 0,
      };
      expect(
        getExplanationKey({
          ...base,
          strategy: 'SELL_LOCAL',
          breakdown: {} as never,
        }),
      ).toBe('dashboard.decisionExplain.SELL_LOCAL');
      expect(
        getExplanationKey({
          ...base,
          strategy: 'PROCESS_AND_SELL_LOCAL',
          breakdown: {} as never,
        }),
      ).toBe('dashboard.decisionExplain.PROCESS_AND_SELL_LOCAL');
      expect(
        getExplanationKey({
          ...base,
          strategy: 'TRANSPORT_AND_SELL',
          breakdown: {} as never,
        }),
      ).toBe('dashboard.decisionExplain.TRANSPORT_AND_SELL');
      expect(
        getExplanationKey({
          ...base,
          strategy: 'PROCESS_THEN_TRANSPORT_AND_SELL',
          breakdown: {} as never,
        }),
      ).toBe('dashboard.decisionExplain.PROCESS_THEN_TRANSPORT_AND_SELL');
    });
  });

  describe('formatTimeSeconds', () => {
    it('returns instant for zero', () => {
      expect(formatTimeSeconds(0, stubT)).toBe('dashboard.decisionTimeInstant');
    });

    it('formats minutes', () => {
      expect(formatTimeSeconds(180, stubT)).toBe(
        'dashboard.decisionTimeMinutes:{"count":3}',
      );
    });

    it('formats hours', () => {
      expect(formatTimeSeconds(7200, stubT)).toBe(
        'dashboard.decisionTimeHours:{"count":2}',
      );
    });

    it('formats hours and minutes', () => {
      expect(formatTimeSeconds(9000, stubT)).toBe(
        'dashboard.decisionTimeHoursMinutes:{"hours":2,"minutes":30}',
      );
    });
  });

  describe('formatRoi', () => {
    it('formats ROI as percentage', () => {
      expect(formatRoi(0.5)).toBe('50.0%');
      expect(formatRoi(1.234)).toBe('123.4%');
      expect(formatRoi(0)).toBe('0.0%');
    });
  });

  describe('getActionSteps', () => {
    it('returns a single sell step for SELL_LOCAL', () => {
      const result: StrategyResult = {
        strategy: 'SELL_LOCAL',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        net: 100,
        roi: 0.5,
        time: 0,
        breakdown: { avgPrice: 11, slippageBps: 50, gross: 110, fee: 10 },
      };
      const steps = getActionSteps(result, {
        t: stubT,
        formatNumber: stubFormatNumber,
      });
      expect(steps).toHaveLength(1);
      expect(steps[0].key).toBe('sell');
      expect(steps[0].labelKey).toBe('dashboard.decisionActionStepSell');
    });

    it('returns process and sell steps for PROCESS_AND_SELL_LOCAL', () => {
      const result: StrategyResult = {
        strategy: 'PROCESS_AND_SELL_LOCAL',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        net: 200,
        roi: 0.8,
        time: 60,
        breakdown: {
          inputAmount: 10,
          outputAmount: 5,
          outputResourceId: 'iron_ingot',
          inputCostOpportunity: 110,
          outputRevenue: 320,
          outputSlippageBps: 30,
          outputFee: 10,
          processingTime: 60,
        },
      };
      const steps = getActionSteps(result, {
        t: stubT,
        formatNumber: stubFormatNumber,
      });
      expect(steps).toHaveLength(2);
      expect(steps[0].key).toBe('process');
      expect(steps[1].key).toBe('sell');
      expect(steps[1].params.resource).toBe('resources.iron_ingot.name');
    });

    it('returns transport and sell steps for TRANSPORT_AND_SELL', () => {
      const result: StrategyResult = {
        strategy: 'TRANSPORT_AND_SELL',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        net: 150,
        roi: 0.6,
        time: 120,
        breakdown: {
          destinationRegion: 'greenhaven',
          localAvgPrice: 11,
          remoteAvgPrice: 16,
          remoteSlippageBps: 40,
          transportCost: 20,
          transportTime: 120,
          remoteGross: 160,
          remoteFee: 10,
        },
      };
      const steps = getActionSteps(result, {
        t: stubT,
        formatNumber: stubFormatNumber,
      });
      expect(steps).toHaveLength(2);
      expect(steps[0].key).toBe('transport');
      expect(steps[1].key).toBe('sell');
    });

    it('returns process, transport and sell steps for PROCESS_THEN_TRANSPORT_AND_SELL', () => {
      const result: StrategyResult = {
        strategy: 'PROCESS_THEN_TRANSPORT_AND_SELL',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        net: 300,
        roi: 1.2,
        time: 180,
        breakdown: {
          inputAmount: 10,
          outputAmount: 5,
          outputResourceId: 'iron_ingot',
          inputCostOpportunity: 110,
          destinationRegion: 'greenhaven',
          outputRevenue: 420,
          outputSlippageBps: 20,
          transportCost: 30,
          transportTime: 120,
          processingTime: 60,
          remoteFee: 10,
        },
      };
      const steps = getActionSteps(result, {
        t: stubT,
        formatNumber: stubFormatNumber,
      });
      expect(steps).toHaveLength(3);
      expect(steps[0].key).toBe('process');
      expect(steps[1].key).toBe('transport');
      expect(steps[2].key).toBe('sell');
      expect(steps[2].params.resource).toBe('resources.iron_ingot.name');
    });
  });
});
