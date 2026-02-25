// src/config/abis/index.ts

import USDC from "./USDC.json";
import SingleWinnerDeployer from "./SingleWinnerDeployer.json";
import SingleWinnerLottery from "./SingleWinnerLottery.json";
import LotteryRegistry from "./LotteryRegistry.json";

export const ABIS = {
  USDC,
  SingleWinnerDeployer,
  SingleWinnerLottery,
  LotteryRegistry,
} as const;