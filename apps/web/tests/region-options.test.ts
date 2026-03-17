import { describe, expect, it } from 'vitest';
import { regionOptions } from '../src/features/onboarding/region-options';

describe('region selection options', () => {
  it('keeps the onboarding regions aligned with the shared starter world seed', () => {
    expect(regionOptions.map((region) => region.id)).toEqual([
      'ironridge',
      'greenhaven',
      'sunbarrel',
      'riverplain',
    ]);
  });
});
