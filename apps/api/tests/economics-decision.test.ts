import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import * as supabaseClient from '../src/db/client/supabase';

const appsToClose: ReturnType<typeof buildApp>[] = [];

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(appsToClose.splice(0).map((app) => app.close()));
});

const ALL_RESOURCES = [
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

function createResourcesMock() {
  let selectedId = '';

  const query = {
    eq: vi.fn((col: string, val: string) => {
      if (col === 'id') selectedId = val;
      return query;
    }),
    in: vi.fn(() => ({
      returns: vi.fn().mockResolvedValue({ data: ALL_RESOURCES, error: null }),
    })),
    maybeSingle: vi.fn().mockImplementation(() => {
      const r = ALL_RESOURCES.find((entry) => entry.id === selectedId);
      return Promise.resolve({ data: r ?? null, error: null });
    }),
  };

  return { select: vi.fn().mockReturnValue(query) };
}

function createDecisionMock() {
  const player = {
    id: 'user-decision',
    locale: 'en' as const,
    credits: 5000,
    region_id: 'ironridge',
  };

  const locationRows = [
    {
      id: 'location-primary',
      key: 'primary_storage',
      name_key: 'locations.primary_storage.name',
    },
    {
      id: 'location-remote',
      key: 'remote_storage',
      name_key: 'locations.remote_storage.name',
    },
  ];

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-decision', email: 'op@id.com' } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: (table: string) => {
      if (table === 'players') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: player, error: null }),
            }),
          })),
        };
      }

      if (table === 'resources') {
        return createResourcesMock();
      }

      if (table === 'player_locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                returns: vi
                  .fn()
                  .mockResolvedValue({ data: locationRows, error: null }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof supabaseClient.createSupabaseAdminClient>;
}

describe('TASK-057: Economics Decision Preview — Integration', () => {
  it('returns ranked strategies for a valid request', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty('ranked');
    expect(Array.isArray(body.ranked)).toBe(true);
    expect(body.ranked.length).toBeGreaterThan(0);

    const strategies = body.ranked.map((s: { strategy: string }) => s.strategy);
    expect(strategies).toContain('SELL_LOCAL');

    for (const strategy of body.ranked) {
      expect(strategy).toHaveProperty('strategy');
      expect(strategy).toHaveProperty('resource', 'iron_ore');
      expect(strategy).toHaveProperty('quantity', 24);
      expect(strategy).toHaveProperty('region', 'ironridge');
      expect(strategy).toHaveProperty('net');
      expect(strategy).toHaveProperty('roi');
      expect(strategy).toHaveProperty('time');
      expect(strategy).toHaveProperty('breakdown');
      expect(typeof strategy.net).toBe('number');
      expect(Number.isNaN(strategy.net)).toBe(false);
    }
  });

  it('includes all 4 strategies for processable resource with sufficient quantity', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const strategies = body.ranked.map((s: { strategy: string }) => s.strategy);

    expect(strategies).toContain('SELL_LOCAL');
    expect(strategies).toContain('PROCESS_AND_SELL_LOCAL');
    expect(strategies).toContain('TRANSPORT_AND_SELL');
    expect(strategies).toContain('PROCESS_THEN_TRANSPORT_AND_SELL');
  });

  it('best strategy is at index 0 with highest net', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const nets = body.ranked.map((s: { net: number }) => s.net);
    const maxNet = Math.max(...nets);
    expect(body.ranked[0].net).toBe(maxNet);
  });

  it('transport strategies include destinationRegion', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    const transport = body.ranked.find(
      (s: { strategy: string }) => s.strategy === 'TRANSPORT_AND_SELL',
    );
    expect(transport).toBeDefined();
    expect(transport.breakdown).toHaveProperty('destinationRegion');

    const processTransport = body.ranked.find(
      (s: { strategy: string }) =>
        s.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL',
    );
    expect(processTransport).toBeDefined();
    expect(processTransport.breakdown).toHaveProperty('destinationRegion');
  });

  it('returns 400 for invalid payload', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: -1,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Invalid decision preview payload.',
    });
  });

  it('returns consistent results for identical requests', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const payload = {
      resource: 'wood',
      quantity: 24,
      region: 'greenhaven',
    };
    const headers = { authorization: 'Bearer valid-token' };

    const r1 = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers,
      payload,
    });

    const r2 = await app.inject({
      method: 'POST',
      url: '/economics/decision-preview',
      headers,
      payload,
    });

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json()).toEqual(r2.json());
  });
});

function createBatchAnalysisMock(nonTradableResource?: string) {
  const resources = nonTradableResource
    ? ALL_RESOURCES.map((r) =>
        r.id === nonTradableResource ? { ...r, tradable: false } : r,
      )
    : ALL_RESOURCES;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-batch', email: 'batch@id.com' } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: (table: string) => {
      if (table === 'resources') {
        let selectedId = '';

        const query = {
          eq: vi.fn((col: string, val: string) => {
            if (col === 'id') selectedId = val;
            return query;
          }),
          in: vi.fn(() => ({
            returns: vi
              .fn()
              .mockResolvedValue({ data: resources, error: null }),
          })),
          maybeSingle: vi.fn().mockImplementation(() => {
            const r = resources.find((entry) => entry.id === selectedId);
            return Promise.resolve({ data: r ?? null, error: null });
          }),
        };

        return { select: vi.fn().mockReturnValue(query) };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })),
      };
    },
  } as unknown as ReturnType<typeof supabaseClient.createSupabaseAdminClient>;
}

describe('TASK-060: Batch Analysis — Integration', () => {
  it('returns analyses for valid multi-region multi-quantity request', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createBatchAnalysisMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/batch-analysis',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantities: [10, 50],
        regions: ['ironridge', 'greenhaven'],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('analyses');
    expect(Array.isArray(body.analyses)).toBe(true);
    expect(body.analyses).toHaveLength(4);
  });

  it('each analysis entry has correct shape with ranked strategies', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createBatchAnalysisMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/batch-analysis',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantities: [24],
        regions: ['ironridge'],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.analyses).toHaveLength(1);

    const entry = body.analyses[0];
    expect(entry).toHaveProperty('resource', 'iron_ore');
    expect(entry).toHaveProperty('quantity', 24);
    expect(entry).toHaveProperty('region', 'ironridge');
    expect(entry).toHaveProperty('snapshot');
    expect(entry.snapshot).toHaveProperty('ranked');
    expect(Array.isArray(entry.snapshot.ranked)).toBe(true);
    expect(entry.snapshot.ranked.length).toBeGreaterThan(0);

    const strategy = entry.snapshot.ranked[0];
    expect(strategy).toHaveProperty('strategy');
    expect(strategy).toHaveProperty('net');
    expect(strategy).toHaveProperty('roi');
    expect(strategy).toHaveProperty('time');
    expect(strategy).toHaveProperty('breakdown');
  });

  it('returns 400 for invalid payload (empty quantities)', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createBatchAnalysisMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/batch-analysis',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantities: [],
        regions: ['ironridge'],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Invalid batch analysis payload.',
    });
  });

  it('returns 400 for non-tradable resource', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createBatchAnalysisMock('iron_ore'),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/batch-analysis',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantities: [10],
        regions: ['ironridge'],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('error', 'Bad Request');
  });

  it('returns deterministic results for identical requests', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createBatchAnalysisMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const payload = {
      resource: 'wood',
      quantities: [10, 20],
      regions: ['greenhaven'],
    };
    const headers = { authorization: 'Bearer valid-token' };

    const r1 = await app.inject({
      method: 'POST',
      url: '/economics/batch-analysis',
      headers,
      payload,
    });

    const r2 = await app.inject({
      method: 'POST',
      url: '/economics/batch-analysis',
      headers,
      payload,
    });

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json()).toEqual(r2.json());
  });
});

function createExecuteMock() {
  const player = {
    id: 'user-exec',
    locale: 'en' as const,
    credits: 5000,
    region_id: 'ironridge',
  };

  const decisionLogRows: unknown[] = [];

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-exec', email: 'exec@id.com' } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          decision_id: 'dec-001',
          order_id: 'ord-001',
          price_per_unit: 18,
          gross_amount: 180,
          fee_amount: 4,
          net_amount: 176,
          inventory_quantity: 0,
          player_credits: 5176,
        },
      ],
      error: null,
    }),
    from: (table: string) => {
      if (table === 'resources') {
        return createResourcesMock();
      }

      if (table === 'decision_log') {
        return {
          insert: vi.fn(() => ({
            values: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  returns: vi
                    .fn()
                    .mockResolvedValue({ data: decisionLogRows, error: null }),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'players') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: player, error: null }),
            }),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })),
      };
    },
  } as unknown as ReturnType<typeof supabaseClient.createSupabaseAdminClient>;
}

describe('TASK-059: Decision Execute & History — Integration', () => {
  it('executes a SELL_LOCAL decision via POST /decision-execute', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createExecuteMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-execute',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        strategy: 'SELL_LOCAL',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('decisionId', 'dec-001');
    expect(body).toHaveProperty('orderId', 'ord-001');
    expect(body).toHaveProperty('strategy', 'SELL_LOCAL');
    expect(body).toHaveProperty('resource', 'iron_ore');
    expect(body).toHaveProperty('quantity', 10);
    expect(body).toHaveProperty('region', 'ironridge');
    expect(body).toHaveProperty('netAmount');
    expect(body).toHaveProperty('playerCredits');
  });

  it('executes a PROCESS_AND_SELL_LOCAL decision via POST /decision-execute', async () => {
    const processMock = createExecuteMock();
    const originalFrom = processMock.from.bind(processMock);

    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          decision_id: 'dec-process-001',
          order_id: 'ord-process-001',
          price_per_unit: 42,
          gross_amount: 252,
          fee_amount: 6,
          net_amount: 246,
          input_consumed: 12,
          output_produced: 6,
          output_resource_id: 'iron_ingot',
          inventory_quantity: 12,
          player_credits: 5246,
        },
      ],
      error: null,
    });

    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue({
      ...processMock,
      from: originalFrom,
      rpc: mockRpc,
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAdminClient>);
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-execute',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        strategy: 'PROCESS_AND_SELL_LOCAL',
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('decisionId', 'dec-process-001');
    expect(body).toHaveProperty('orderId', 'ord-process-001');
    expect(body).toHaveProperty('strategy', 'PROCESS_AND_SELL_LOCAL');
    expect(body).toHaveProperty('resource', 'iron_ore');
    expect(body).toHaveProperty('quantity', 24);
    expect(body).toHaveProperty('outputResourceId', 'iron_ingot');
    expect(body).toHaveProperty('inputConsumed', 12);
    expect(body).toHaveProperty('outputProduced', 6);
    expect(body).toHaveProperty('netAmount', 246);
    expect(body).toHaveProperty('playerCredits', 5246);

    expect(mockRpc).toHaveBeenCalledWith(
      'execute_decision_process_and_sell_local',
      expect.objectContaining({
        p_input_resource_id: 'iron_ore',
        p_input_amount: 24,
        p_output_resource_id: 'iron_ingot',
        p_output_amount: 12,
      }),
    );
  });

  it('returns 400 for PROCESS_AND_SELL_LOCAL with quantity below recipe threshold', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createExecuteMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-execute',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        strategy: 'PROCESS_AND_SELL_LOCAL',
        resource: 'iron_ore',
        quantity: 5,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error', 'Bad Request');
  });

  it('records TRANSPORT_AND_SELL strategy as recorded (not executed)', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createExecuteMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-execute',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        strategy: 'TRANSPORT_AND_SELL',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('decisionId', 'pending');
    expect(body).toHaveProperty('strategy', 'TRANSPORT_AND_SELL');
  });

  it('records PROCESS_THEN_TRANSPORT_AND_SELL strategy as recorded', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createExecuteMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-execute',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        strategy: 'PROCESS_THEN_TRANSPORT_AND_SELL',
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('decisionId', 'pending');
    expect(body).toHaveProperty('strategy', 'PROCESS_THEN_TRANSPORT_AND_SELL');
  });

  it('returns 400 for invalid decision execute payload', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createExecuteMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/decision-execute',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        strategy: 'INVALID',
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Invalid decision execute payload.',
    });
  });

  it('returns decision history via GET /decision-history', async () => {
    const mockWithHistory = createExecuteMock();
    const historyData = [
      {
        id: 'dec-001',
        strategy: 'SELL_LOCAL',
        resource_id: 'iron_ore',
        quantity: 10,
        origin_region: 'ironridge',
        destination_region: null,
        result: { netAmount: 176 },
        status: 'executed',
        created_at: '2026-04-23T00:00:00Z',
      },
    ];

    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue({
      ...mockWithHistory,
      from: (table: string) => {
        if (table === 'decision_log') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    returns: vi
                      .fn()
                      .mockResolvedValue({ data: historyData, error: null }),
                  })),
                })),
              })),
            })),
          };
        }
        return (mockWithHistory as { from: (t: string) => unknown }).from(
          table,
        );
      },
    } as unknown as ReturnType<
      typeof supabaseClient.createSupabaseAdminClient
    >);
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/economics/decision-history',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('history');
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBe(1);
    expect(body.history[0]).toHaveProperty('strategy', 'SELL_LOCAL');
    expect(body.history[0]).toHaveProperty('resourceId', 'iron_ore');
    expect(body.history[0]).toHaveProperty('quantity', 10);
    expect(body.history[0]).toHaveProperty('originRegion', 'ironridge');
    expect(body.history[0]).toHaveProperty('status', 'executed');
  });

  it('returns history with PROCESS_AND_SELL_LOCAL executed entry', async () => {
    const mockWithHistory = createExecuteMock();
    const historyData = [
      {
        id: 'dec-process-002',
        strategy: 'PROCESS_AND_SELL_LOCAL',
        resource_id: 'iron_ore',
        quantity: 24,
        origin_region: 'ironridge',
        destination_region: null,
        result: {
          inputConsumed: 24,
          outputProduced: 12,
          outputResourceId: 'iron_ingot',
          netAmount: 498,
        },
        status: 'executed',
        created_at: '2026-04-26T00:00:00Z',
      },
      {
        id: 'dec-001',
        strategy: 'SELL_LOCAL',
        resource_id: 'iron_ore',
        quantity: 10,
        origin_region: 'ironridge',
        destination_region: null,
        result: { netAmount: 176 },
        status: 'executed',
        created_at: '2026-04-23T00:00:00Z',
      },
    ];

    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue({
      ...mockWithHistory,
      from: (table: string) => {
        if (table === 'decision_log') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    returns: vi
                      .fn()
                      .mockResolvedValue({ data: historyData, error: null }),
                  })),
                })),
              })),
            })),
          };
        }
        return (mockWithHistory as { from: (t: string) => unknown }).from(
          table,
        );
      },
    } as unknown as ReturnType<
      typeof supabaseClient.createSupabaseAdminClient
    >);
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/economics/decision-history',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.history.length).toBe(2);
    expect(body.history[0]).toHaveProperty('strategy', 'PROCESS_AND_SELL_LOCAL');
    expect(body.history[0]).toHaveProperty('status', 'executed');
    expect(body.history[0].result).toHaveProperty('inputConsumed', 24);
    expect(body.history[0].result).toHaveProperty('outputProduced', 12);
    expect(body.history[0].result).toHaveProperty('outputResourceId', 'iron_ingot');
    expect(body.history[1]).toHaveProperty('strategy', 'SELL_LOCAL');
  });
});

describe('TASK-061: Market Signals — Integration', () => {
  it('returns signals for a valid request', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/market-signals',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'fuel',
        quantity: 10,
        region: 'sunbarrel',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('signals');
    expect(Array.isArray(body.signals)).toBe(true);
  });

  it('each signal has correct shape with key, severity, and params', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/market-signals',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'fuel',
        quantity: 10,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    for (const signal of body.signals) {
      expect(signal).toHaveProperty('key');
      expect(typeof signal.key).toBe('string');
      expect(signal).toHaveProperty('severity');
      expect(['info', 'caution', 'warning']).toContain(signal.severity);
      expect(signal).toHaveProperty('params');
      expect(typeof signal.params).toBe('object');
    }
  });

  it('returns 400 for invalid payload (negative quantity)', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/market-signals',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: -5,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Invalid market signals payload.',
    });
  });

  it('returns 400 for non-tradable resource', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createBatchAnalysisMock('iron_ore'),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/market-signals',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('error', 'Bad Request');
  });

  it('high quantity triggers EXCEEDS_LIQUIDITY_DEPTH signal', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createDecisionMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/economics/market-signals',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        resource: 'fuel',
        quantity: 200,
        region: 'ironridge',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const keys = body.signals.map((s: { key: string }) => s.key);
    expect(keys).toContain('EXCEEDS_LIQUIDITY_DEPTH');
  });
});
