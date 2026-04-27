import type {
  EconomicStrategy,
  StrategyBreakdownProcessAndSellLocal,
  StrategyBreakdownProcessThenTransportAndSell,
  StrategyBreakdownSellLocal,
  StrategyBreakdownTransportAndSell,
  StrategyResult,
} from '@industrial-dominion/shared';

export type { EconomicStrategy, StrategyResult };

export function getStrategyLabelKey(strategy: EconomicStrategy): string {
  const map: Record<EconomicStrategy, string> = {
    SELL_LOCAL: 'dashboard.decisionStrategy.SELL_LOCAL',
    PROCESS_AND_SELL_LOCAL: 'dashboard.decisionStrategy.PROCESS_AND_SELL_LOCAL',
    TRANSPORT_AND_SELL: 'dashboard.decisionStrategy.TRANSPORT_AND_SELL',
    PROCESS_THEN_TRANSPORT_AND_SELL:
      'dashboard.decisionStrategy.PROCESS_THEN_TRANSPORT_AND_SELL',
  };
  return map[strategy];
}

function isProcessAndSellLocal(
  b: StrategyResult['breakdown'],
): b is StrategyBreakdownProcessAndSellLocal {
  return 'outputResourceId' in b && !('destinationRegion' in b);
}

function isTransportAndSell(
  b: StrategyResult['breakdown'],
): b is StrategyBreakdownTransportAndSell {
  return 'destinationRegion' in b && !('outputResourceId' in b);
}

function isProcessThenTransport(
  b: StrategyResult['breakdown'],
): b is StrategyBreakdownProcessThenTransportAndSell {
  return 'outputResourceId' in b && 'destinationRegion' in b;
}

export function getExplanationKey(result: StrategyResult): string {
  const map: Record<EconomicStrategy, string> = {
    SELL_LOCAL: 'dashboard.decisionExplain.SELL_LOCAL',
    PROCESS_AND_SELL_LOCAL: 'dashboard.decisionExplain.PROCESS_AND_SELL_LOCAL',
    TRANSPORT_AND_SELL: 'dashboard.decisionExplain.TRANSPORT_AND_SELL',
    PROCESS_THEN_TRANSPORT_AND_SELL:
      'dashboard.decisionExplain.PROCESS_THEN_TRANSPORT_AND_SELL',
  };
  return map[result.strategy];
}

export function getExplanationParams(
  result: StrategyResult,
  opts: {
    t: (key: string) => string;
    formatCurrency: (v: number) => string;
    formatNumber: (v: number) => string;
  },
): Record<string, string | number> {
  const { t, formatCurrency, formatNumber } = opts;
  const base: Record<string, string | number> = {
    quantity: formatNumber(result.quantity),
    resource: t(`resources.${result.resource}.name`),
    net: formatCurrency(result.net),
    roi: (result.roi * 100).toFixed(1),
    time: formatTimeSeconds(result.time, t),
  };

  if (result.strategy === 'SELL_LOCAL') {
    const b = result.breakdown as StrategyBreakdownSellLocal;
    base.gross = formatCurrency(b.gross);
    base.fee = formatCurrency(b.fee);
  }

  if (isProcessAndSellLocal(result.breakdown)) {
    base.inputAmount = formatNumber(result.breakdown.inputAmount);
    base.outputAmount = formatNumber(result.breakdown.outputAmount);
    base.outputResource = t(
      `resources.${result.breakdown.outputResourceId}.name`,
    );
    base.processingTime = formatTimeSeconds(result.breakdown.processingTime, t);
    base.outputFee = formatCurrency(result.breakdown.outputFee);
  }

  if (isTransportAndSell(result.breakdown)) {
    base.destination = t(`regions.${result.breakdown.destinationRegion}.name`);
    base.transportCost = formatCurrency(result.breakdown.transportCost);
    base.transportTime = formatTimeSeconds(result.breakdown.transportTime, t);
    base.remoteFee = formatCurrency(result.breakdown.remoteFee);
  }

  if (isProcessThenTransport(result.breakdown)) {
    base.inputAmount = formatNumber(result.breakdown.inputAmount);
    base.outputAmount = formatNumber(result.breakdown.outputAmount);
    base.outputResource = t(
      `resources.${result.breakdown.outputResourceId}.name`,
    );
    base.destination = t(`regions.${result.breakdown.destinationRegion}.name`);
    base.processingTime = formatTimeSeconds(result.breakdown.processingTime, t);
    base.transportCost = formatCurrency(result.breakdown.transportCost);
    base.transportTime = formatTimeSeconds(result.breakdown.transportTime, t);
    base.remoteFee = formatCurrency(result.breakdown.remoteFee);
  }

  return base;
}

export function formatTimeSeconds(
  seconds: number,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  if (seconds <= 0) return t('dashboard.decisionTimeInstant');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return t('dashboard.decisionTimeMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0)
    return t('dashboard.decisionTimeHours', { count: hours });
  return t('dashboard.decisionTimeHoursMinutes', {
    hours,
    minutes: remainingMinutes,
  });
}

export function formatRoi(roi: number): string {
  return `${(roi * 100).toFixed(1)}%`;
}

export interface ActionStep {
  key: string;
  labelKey: string;
  params: Record<string, string | number>;
}

export function getActionSteps(
  result: StrategyResult,
  opts: {
    t: (key: string) => string;
    formatNumber: (v: number) => string;
  },
): ActionStep[] {
  const { t, formatNumber } = opts;
  const steps: ActionStep[] = [];

  if (isProcessAndSellLocal(result.breakdown)) {
    steps.push({
      key: 'process',
      labelKey: 'dashboard.decisionActionStepProcess',
      params: {
        inputAmount: formatNumber(result.breakdown.inputAmount),
        inputResource: t(`resources.${result.resource}.name`),
        outputAmount: formatNumber(result.breakdown.outputAmount),
        outputResource: t(
          `resources.${result.breakdown.outputResourceId}.name`,
        ),
      },
    });
  }

  if (isProcessThenTransport(result.breakdown)) {
    steps.push({
      key: 'process',
      labelKey: 'dashboard.decisionActionStepProcess',
      params: {
        inputAmount: formatNumber(result.breakdown.inputAmount),
        inputResource: t(`resources.${result.resource}.name`),
        outputAmount: formatNumber(result.breakdown.outputAmount),
        outputResource: t(
          `resources.${result.breakdown.outputResourceId}.name`,
        ),
      },
    });
  }

  if (isTransportAndSell(result.breakdown)) {
    steps.push({
      key: 'transport',
      labelKey: 'dashboard.decisionActionStepTransport',
      params: {
        quantity: formatNumber(result.quantity),
        resource: t(`resources.${result.resource}.name`),
        destination: t(`regions.${result.breakdown.destinationRegion}.name`),
      },
    });
  }

  if (isProcessThenTransport(result.breakdown)) {
    steps.push({
      key: 'transport',
      labelKey: 'dashboard.decisionActionStepTransport',
      params: {
        quantity: formatNumber(result.breakdown.outputAmount),
        resource: t(`resources.${result.breakdown.outputResourceId}.name`),
        destination: t(`regions.${result.breakdown.destinationRegion}.name`),
      },
    });
  }

  const sellResourceId = isProcessAndSellLocal(result.breakdown)
    ? result.breakdown.outputResourceId
    : isProcessThenTransport(result.breakdown)
      ? result.breakdown.outputResourceId
      : result.resource;

  steps.push({
    key: 'sell',
    labelKey: 'dashboard.decisionActionStepSell',
    params: {
      resource: t(`resources.${sellResourceId}.name`),
      region: t(`regions.${result.region}.name`),
    },
  });

  return steps;
}
