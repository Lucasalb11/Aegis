import { Pool } from "@/src/types/pool";

const iconSol =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAOc2v63wG7G_vjriVQDPKbl7GcaOeGugQjhP8XT1sFfVW8IfMfB1yWMRRAXNRMOeUsJP_-31PoYUzTqUY0NuZrff-G8j-5vxc-pds83pc--J7NrJJcBWxVTDjl0Edg6ElQRDnApc4Sji6B-46nn_WFo_mdrZBq8lp1jzklSZT6AK20QIuDn4ojmefNJWVkAKP9B7Ib0GNUJRv5nS_gbCivNBtV4PnWpNeodiQkGenvtgnJGdf3xUBJyiyuw7vnWNJRhlk3KKzNvn1L";
const iconUsdc =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAykMhiUJhX_Q_0jS-jnKFU-knoD1oau_n2p2Ru_xQDpK1kPTWnYPZOKImrwQEAm_4aJeuLM4wsaI7X2nxCoTAWtoBY_gTKvOSe07nl4KEuCPr6kRml2G9wNhtMdA4FfidRYKxWy99Vh0nMeI59vq6EmIiI8R2iSU-GhRt1cVySx0xdNpfoVNXsY9AbODho7szpVt1CIxYIdL0mSqQn-nX1JtMhpLei1TOloY7gMDHjmbmWapt9WsQXT1Z4gYIt4PX7C_B1rdxSaB70";
const iconMsol =
  "https://assets.coingecko.com/coins/images/17752/small/mSOL.png?1696516777";
const iconBonk =
  "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg?1696528245";

export const mockPools: Pool[] = [
  {
    slug: "aegis-ausd",
    name: "AEGIS-AUSD Pool",
    pair: "AEGIS/AUSD",
    tokens: [
      { symbol: "AEGIS", icon: iconSol, amount: 500_000, usd: 2_500_000 },
      { symbol: "AUSD", icon: iconUsdc, amount: 2_500_000, usd: 2_500_000 },
    ],
    tvlUsd: 5_000_000,
    volume24hUsd: 500_000,
    fees24hUsd: 1_500,
    apr: 45.2,
    ilComparison: { initial: 10_000, hodl: 11_200, current: 11_800 },
    history: [
      { label: "1D", apr: 45.2 },
      { label: "1W", apr: 44.8 },
      { label: "1M", apr: 45.2 },
      { label: "3M", apr: 46.1 },
      { label: "1Y", apr: 42.5 },
    ],
  },
  {
    slug: "aero-ausd",
    name: "AERO-AUSD Pool",
    pair: "AERO/AUSD",
    tokens: [
      { symbol: "AERO", icon: iconMsol, amount: 400_000, usd: 2_000_000 },
      { symbol: "AUSD", icon: iconUsdc, amount: 2_000_000, usd: 2_000_000 },
    ],
    tvlUsd: 4_000_000,
    volume24hUsd: 300_000,
    fees24hUsd: 600,
    apr: 38.7,
    ilComparison: { initial: 10_000, hodl: 10_500, current: 10_900 },
    history: [
      { label: "1D", apr: 38.2 },
      { label: "1W", apr: 38.6 },
      { label: "1M", apr: 38.7 },
      { label: "3M", apr: 39.1 },
      { label: "1Y", apr: 37.9 },
    ],
  },
  {
    slug: "abtc-ausd",
    name: "ABTC-AUSD Pool",
    pair: "ABTC/AUSD",
    tokens: [
      { symbol: "ABTC", icon: iconBonk, amount: 100, usd: 3_000_000 },
      { symbol: "AUSD", icon: iconUsdc, amount: 3_000_000, usd: 3_000_000 },
    ],
    tvlUsd: 6_000_000,
    volume24hUsd: 800_000,
    fees24hUsd: 2_400,
    apr: 52.2,
    ilComparison: { initial: 10_000, hodl: 9_800, current: 11_900 },
    history: [
      { label: "1D", apr: 52.0 },
      { label: "1W", apr: 53.4 },
      { label: "1M", apr: 52.2 },
      { label: "3M", apr: 50.1 },
      { label: "1Y", apr: 46.0 },
    ],
  },
  {
    slug: "aegis-asol",
    name: "AEGIS-ASOL Pool",
    pair: "AEGIS/ASOL",
    tokens: [
      { symbol: "AEGIS", icon: iconSol, amount: 300_000, usd: 1_500_000 },
      { symbol: "ASOL", icon: iconMsol, amount: 1_500_000, usd: 1_500_000 },
    ],
    tvlUsd: 3_000_000,
    volume24hUsd: 200_000,
    fees24hUsd: 1_050,
    apr: 42.4,
    ilComparison: { initial: 10_000, hodl: 11_000, current: 11_500 },
    history: [
      { label: "1D", apr: 42.0 },
      { label: "1W", apr: 41.8 },
      { label: "1M", apr: 42.4 },
      { label: "3M", apr: 43.1 },
      { label: "1Y", apr: 39.5 },
    ],
  },
  {
    slug: "abtc-asol",
    name: "ABTC-ASOL Pool",
    pair: "ABTC/ASOL",
    tokens: [
      { symbol: "ABTC", icon: iconBonk, amount: 75, usd: 2_250_000 },
      { symbol: "ASOL", icon: iconMsol, amount: 2_250_000, usd: 2_250_000 },
    ],
    tvlUsd: 4_500_000,
    volume24hUsd: 400_000,
    fees24hUsd: 1_600,
    apr: 48.2,
    ilComparison: { initial: 10_000, hodl: 10_200, current: 11_300 },
    history: [
      { label: "1D", apr: 48.0 },
      { label: "1W", apr: 47.8 },
      { label: "1M", apr: 48.2 },
      { label: "3M", apr: 47.1 },
      { label: "1Y", apr: 44.5 },
    ],
  },
];
