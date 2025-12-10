export type TokenInfo = {
  symbol: string;
  icon: string;
  amount: number;
  usd: number;
};

export type HistoricalPoint = {
  label: string;
  apr: number;
};

export type Pool = {
  slug: string;
  name: string;
  pair: string;
  tokens: [TokenInfo, TokenInfo];
  tvlUsd: number;
  volume24hUsd: number;
  fees24hUsd: number;
  apr: number;
  ilComparison: {
    initial: number;
    hodl: number;
    current: number;
  };
  history: HistoricalPoint[];
};
