import { describe, expect, it } from 'vitest';
import {
  getStarterProcessingInstallation,
  starterProcessingInstallationCatalog,
} from '../src';

describe('starter processing installation catalog', () => {
  it('defines the minimal starter processing installation', () => {
    expect(starterProcessingInstallationCatalog).toEqual([
      {
        id: 'starter_processing_installation',
        nameKey: 'buildingTypes.starter_processing_installation.name',
        descriptionKey: 'buildingTypes.starter_processing_installation.description',
        category: 'processing',
      },
    ]);
  });

  it('returns the first starter processing installation', () => {
    expect(getStarterProcessingInstallation()?.id).toBe('starter_processing_installation');
  });
});
