import { describe, expect, it } from 'vitest';
import {
  calculateTransportCost,
  calculateTransportTime,
  getAllRegionDistances,
  getDistanceBetweenRegions,
  logisticsConfig,
} from '../src/economics/logistics';

describe('TASK-056: Logistics Cost & Time Model — Unit Tests', () => {
  describe('1. Distance Model Integrity', () => {
    it('same region has zero distance', () => {
      expect(getDistanceBetweenRegions('ironridge', 'ironridge')).toBe(0);
      expect(getDistanceBetweenRegions('greenhaven', 'greenhaven')).toBe(0);
      expect(getDistanceBetweenRegions('sunbarrel', 'sunbarrel')).toBe(0);
      expect(getDistanceBetweenRegions('riverplain', 'riverplain')).toBe(0);
    });

    it('distances are symmetric', () => {
      expect(getDistanceBetweenRegions('ironridge', 'greenhaven')).toBe(
        getDistanceBetweenRegions('greenhaven', 'ironridge'),
      );
      expect(getDistanceBetweenRegions('ironridge', 'sunbarrel')).toBe(
        getDistanceBetweenRegions('sunbarrel', 'ironridge'),
      );
      expect(getDistanceBetweenRegions('greenhaven', 'riverplain')).toBe(
        getDistanceBetweenRegions('riverplain', 'greenhaven'),
      );
    });

    it('all region pairs have positive distance', () => {
      const distances = getAllRegionDistances();
      for (const dist of Object.values(distances)) {
        expect(dist).toBeGreaterThan(0);
      }
    });

    it('every pair of distinct regions has a defined distance', () => {
      const regions = [
        'ironridge',
        'greenhaven',
        'sunbarrel',
        'riverplain',
      ] as const;
      let pairCount = 0;
      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          const dist = getDistanceBetweenRegions(regions[i], regions[j]);
          expect(dist).toBeGreaterThan(0);
          pairCount++;
        }
      }
      expect(pairCount).toBe(6);
    });
  });

  describe('2. Transport Cost Model', () => {
    it('zero distance produces zero cost', () => {
      expect(
        calculateTransportCost({
          quantity: 100,
          originRegion: 'ironridge',
          destinationRegion: 'ironridge',
        }),
      ).toBe(0);
    });

    it('higher distance produces higher cost', () => {
      const costShort = calculateTransportCost({
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'riverplain',
      });
      const costLong = calculateTransportCost({
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
      });

      const distShort = getDistanceBetweenRegions('ironridge', 'riverplain');
      const distLong = getDistanceBetweenRegions('ironridge', 'sunbarrel');
      expect(distLong).toBeGreaterThan(distShort);
      expect(costLong).toBeGreaterThan(costShort);
    });

    it('cost scales linearly with quantity', () => {
      const cost10 = calculateTransportCost({
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });
      const cost100 = calculateTransportCost({
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });

      expect(cost100).toBeGreaterThan(cost10);
      expect(cost100).toBe(cost10 * 10);
    });

    it('minimum transfer cost is enforced for small quantities', () => {
      const cost = calculateTransportCost({
        quantity: 1,
        originRegion: 'ironridge',
        destinationRegion: 'riverplain',
      });

      expect(cost).toBeGreaterThanOrEqual(logisticsConfig.minimumTransferCost);
    });

    it('cost is deterministic: same inputs produce same outputs', () => {
      const input = {
        quantity: 50,
        originRegion: 'ironridge' as const,
        destinationRegion: 'greenhaven' as const,
      };

      const results = Array.from({ length: 100 }, () =>
        calculateTransportCost(input),
      );
      const first = results[0];
      for (const r of results) {
        expect(r).toBe(first);
      }
    });
  });

  describe('3. Transport Time Model', () => {
    it('zero distance produces zero time', () => {
      expect(
        calculateTransportTime({
          originRegion: 'ironridge',
          destinationRegion: 'ironridge',
        }),
      ).toBe(0);
    });

    it('time scales linearly with distance', () => {
      const time3 = calculateTransportTime({
        originRegion: 'ironridge',
        destinationRegion: 'riverplain',
      });
      const time6 = calculateTransportTime({
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
      });

      expect(time6).toBe(time3 * 2);
    });

    it('time matches config: distance * timePerDistanceUnit', () => {
      const dist = getDistanceBetweenRegions('ironridge', 'greenhaven');
      const time = calculateTransportTime({
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });

      expect(time).toBe(dist * logisticsConfig.timePerDistanceUnit);
    });

    it('time is returned in seconds', () => {
      const time = calculateTransportTime({
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
      });

      expect(time).toBe(6 * 60);
      expect(time).toBe(360);
    });
  });

  describe('4. Monotonic Behavior with Quantity', () => {
    it('transport cost increases monotonically with quantity', () => {
      const quantities = [1, 5, 10, 25, 50, 100, 500, 1000];
      let prevCost = 0;

      for (const qty of quantities) {
        const cost = calculateTransportCost({
          quantity: qty,
          originRegion: 'ironridge',
          destinationRegion: 'sunbarrel',
        });
        expect(cost).toBeGreaterThanOrEqual(prevCost);
        prevCost = cost;
      }
    });
  });
});
