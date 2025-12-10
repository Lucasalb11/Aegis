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
    slug: "sol-usdc",
    name: "SOL-USDC Pool",
    pair: "SOL/USDC",
    tokens: [
      { symbol: "SOL", icon: iconSol, amount: 173_345.5, usd: 6_174_832.12 },
      { symbol: "USDC", icon: iconUsdc, amount: 6_172_345.99, usd: 6_172_345.99 },
    ],
    tvlUsd: 12_350_000,
    volume24hUsd: 1_230_000,
    fees24hUsd: 3_705,
    apr: 32.4,
    ilComparison: { initial: 10_000, hodl: 12_500, current: 12_450 },
    history: [
      { label: "1D", apr: 32.0 },
      { label: "1W", apr: 31.8 },
      { label: "1M", apr: 32.4 },
      { label: "3M", apr: 33.1 },
      { label: "1Y", apr: 29.5 },
    ],
  },
  {
    slug: "msol-sol",
    name: "mSOL-SOL Pool",
    pair: "mSOL/SOL",
    tokens: [
      { symbol: "mSOL", icon: iconMsol, amount: 98_110, usd: 9_210_000 },
      { symbol: "SOL", icon: iconSol, amount: 102_430, usd: 8_420_000 },
    ],
    tvlUsd: 17_630_000,
    volume24hUsd: 2_040_000,
    fees24hUsd: 6_120,
    apr: 18.7,
    ilComparison: { initial: 10_000, hodl: 10_840, current: 11_230 },
    history: [
      { label: "1D", apr: 18.2 },
      { label: "1W", apr: 18.6 },
      { label: "1M", apr: 18.7 },
      { label: "3M", apr: 19.1 },
      { label: "1Y", apr: 17.9 },
    ],
  },
  {
    slug: "bonk-usdc",
    name: "BONK-USDC Pool",
    pair: "BONK/USDC",
    tokens: [
      { symbol: "BONK", icon: iconBonk, amount: 9_500_000_000, usd: 4_200_000 },
      { symbol: "USDC", icon: iconUsdc, amount: 4_250_000, usd: 4_250_000 },
    ],
    tvlUsd: 8_450_000,
    volume24hUsd: 3_700_000,
    fees24hUsd: 11_100,
    apr: 54.2,
    ilComparison: { initial: 10_000, hodl: 9_800, current: 11_900 },
    history: [
      { label: "1D", apr: 52.0 },
      { label: "1W", apr: 53.4 },
      { label: "1M", apr: 54.2 },
      { label: "3M", apr: 50.1 },
      { label: "1Y", apr: 46.0 },
    ],
  },
];
