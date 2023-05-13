import { BigNumber, ethers } from "ethers";
import erc20Abi from "../constants/abis/ERC20.json";
import { archiveRPCs, nativeTokens } from "../utils";
import { blockExplorerAPIs } from "../utils";
import EthDater from "ethereum-block-by-date";
import { SwapContracts, UserAssetSupplied, WantedAsset } from "../Types";
import { JsonRpcSigner, JsonRpcProvider } from "@ethersproject/providers";
import { PositionManager, PositionStructOutput } from "../codegen/PositionManager";
import { ERC20__factory, PositionManagerProxy__factory, PositionManager__factory } from "../codegen";
import deploymentAddresses from "../constants/deployments.json";
import { parseUnits } from "@ethersproject/units";

export const getAmountsOut = async (
  contracts: SwapContracts,
  signer: JsonRpcSigner,
  assetsToConvert: UserAssetSupplied[],
  wantedAssets: WantedAsset[]
) => {
  const provided = {
    tokens: assetsToConvert.map((asset) => asset.contract_address),
    amounts: assetsToConvert.map((asset) => ethers.utils.parseUnits(asset.tokensSupplied, asset.contract_decimals)),
    nfts: [],
  };
  const desired: { outputERC20s: string[]; outputERC721s: any[]; ratios: number[]; minAmountsOut: BigNumber[] } = {
    outputERC20s: [],
    outputERC721s: [],
    ratios: [],
    minAmountsOut: [],
  };
  for (const asset of wantedAssets) {
    desired.outputERC20s.push(asset.contract_address);
    desired.ratios.push(Math.floor(asset.percentage * 10000));
    desired.minAmountsOut.push(
      ethers.utils.parseUnits(asset.minOut.toFixed(asset.contract_decimals), asset.contract_decimals)
    );
  }
  const { amounts, swaps, conversions, expectedUSDValues } = await contracts.universalSwap.getAmountsOut(
    provided,
    desired
  );
  const stableTokenAddress = await contracts.universalSwap.stableToken();
  const stableToken = new ethers.Contract(stableTokenAddress, erc20Abi, signer);
  const expectedAssets: WantedAsset[] = wantedAssets.map((asset, index) => {
    return {
      ...asset,
      expected: +ethers.utils.formatUnits(amounts[index], asset.contract_decimals),
      quote: +ethers.utils.formatUnits(amounts[index], asset.contract_decimals),
    };
  });
  return { swaps, conversions, provided, desired, wantedAssets, expectedAssets };
};

interface PositionToken {
  name: string;
  amount: number;
  value: number;
  address: string;
}

export interface FetchPositionData {
  positionId: number;
  positionData: PositionStructOutput;
  formattedAmount: string;
  decimals: number;
  tokenContract: string;
  name: string;
  usdcValue: number;
  rewards: PositionToken[];
  underlying: PositionToken[];
  closed: boolean;
}

export const fetchPosition = async (id: number, contracts: SwapContracts, signer: JsonRpcSigner, chainId: number) => {
  if (!contracts.positionManager) return;
  let positionData = await contracts.managerHelper.getPosition(id);
  const {
    position,
    bankTokenInfo,
    underlyingTokens,
    underlyingAmounts,
    underlyingValues,
    rewardTokens,
    rewardAmounts,
    rewardValues,
    usdValue,
  } = positionData;
  const stableDecimals = await contracts.stableToken.decimals();
  const usdcValue = +ethers.utils.formatUnits(usdValue, stableDecimals);
  const depositToken = bankTokenInfo.lpToken;
  const depositTokenContract = ERC20__factory.connect(depositToken, signer);
  let decimals: number;
  let name: string;
  if (depositToken != ethers.constants.AddressZero) {
    decimals = await depositTokenContract.decimals();
    name = await depositTokenContract.name();
  } else {
    decimals = 18;
    name = nativeTokens[chainId].contract_name;
  }
  const underlying = await Promise.all(
    underlyingTokens.map(async (token, index) => {
      const contract = ERC20__factory.connect(token, signer);
      const name = await contract.name();
      const decimals = await contract.decimals();
      const amount = +ethers.utils.formatUnits(underlyingAmounts[index], decimals);
      const value = +ethers.utils.formatUnits(underlyingValues[index], stableDecimals);
      return { name, amount, value, address: token };
    })
  );
  const rewards = await Promise.all(
    rewardTokens.map(async (token, index) => {
      const contract = ERC20__factory.connect(token, signer);
      const name = await contract.name();
      const decimals = await contract.decimals();
      const amount = +ethers.utils.formatUnits(rewardAmounts[index], decimals);
      const value = +ethers.utils.formatUnits(rewardValues[index], stableDecimals);
      return { name, amount, value, address: token };
    })
  );

  const closed = await contracts.positionManager.positionClosed(id);

  return {
    positionId: id,
    positionData: position,
    formattedAmount: ethers.utils.formatUnits(position.amount, decimals),
    decimals,
    tokenContract: bankTokenInfo.lpToken,
    name,
    usdcValue,
    rewards,
    underlying,
    closed,
  };
};

const getBlockFromExplorer = async (chainId: number, daysAgo: number) => {
  const timeNow = Math.floor(new Date().getTime() / 1000);
  const url = `${blockExplorerAPIs[chainId]}/api?module=block&action=getblocknobytime&timestamp=${
    timeNow - daysAgo * 24 * 60 * 60
  }&closest=before&apikey=YourApiKeyToken`;
  const response = await fetch(url);
  const block = +(await response.json()).result;
  return block;
};

const getBlockFromProvider = async (provider: JsonRpcProvider, daysAgo: number) => {
  const dater = new EthDater(provider);
  const seconds = daysAgo * 24 * 60 * 60;
  const timeNow = new Date();
  timeNow.setSeconds(timeNow.getSeconds() - seconds);
  const block = await dater.getDate(timeNow);
  return block.block;
};

export const fetchAllLogs = async (chainId: number, positionId: number | string, contract: PositionManager) => {
  const filter = contract.filters.Deposit(positionId)
  const topic = filter.topics[1]
  await new Promise(r => setTimeout(r, 500));
  const query = `${blockExplorerAPIs[chainId]}/api?module=logs&action=getLogs&address=${contract.address}&topic1=${topic}&apikey=K34CKDK8FQJUC6S76TVX2JTZU6V73QGHRA`
  const response = await fetch(query)
  const data = await response.json()
  const logs = data.result
  let iface = new ethers.utils.Interface(PositionManager__factory.abi)
  return logs.map(log=>{
    return {...iface.parseLog(log), blockNumber: parseInt(log.blockNumber, 16), timeStamp: parseInt(log.timeStamp, 16), transactionHash: log.transactionHash}
  })
}

export const getGraphData = async (contracts: SwapContracts, chainId: number, id: string, provider: JsonRpcProvider, duration: number, logs: any) => {
  const rpc = new ethers.providers.JsonRpcProvider(archiveRPCs[chainId])
  const usdcDecimals = await contracts.stableToken.decimals();
  const blocks = [];
  const timestamps = [];
  const numPoints = 30;
  const latestBlock = await provider.getBlock("latest");
  let startBlock = logs[0].blockNumber
  if (duration === -1) {
    startBlock += (latestBlock.number - startBlock) % numPoints;
  } else {
    const durationBlock = await getBlockFromProvider(provider, duration);
    startBlock = durationBlock >= startBlock ? durationBlock : startBlock;
  }
  startBlock += (latestBlock.number - startBlock) % numPoints;
  blocks.push(startBlock);
  while (true) {
    const block = blocks[blocks.length - 1] + (latestBlock.number - startBlock) / numPoints;
    const timestamp = (await provider.getBlock(block)).timestamp;
    timestamps.push(timestamp * 1000);
    if (block >= latestBlock.number || blocks.length === 30) {
      break;
    }
    blocks.push(block);
  }
  blocks.push(latestBlock.number);
  const timestamp = (await provider.getBlock(latestBlock.number)).timestamp;
  timestamps.push(timestamp * 1000);
  const dataPoints = blocks.map((block) => {
    return contracts.managerHelper.connect(rpc).functions.estimateValue(id, contracts.stableToken.address, { blockTag: block });
  });
  const usdValues = await Promise.all(dataPoints);
  const formattedusdValues = usdValues.map((value) =>
    parseFloat(ethers.utils.formatUnits(value.toString(), usdcDecimals))
  );
  let graphData = timestamps.map((timestamp, index) => {
    const time = new Date(timestamp);
    if (timestamps[timestamps.length - 1] - timestamps[0] < 86400000) {
      return {
        name: time.toTimeString().split(" ")[0].slice(0, 5),
        value: formattedusdValues[index].toFixed(4),
      };
    } else {
      return {
        name: `${time.toDateString().split(" ")[2]} ${time.toDateString().split(" ")[1]}`,
        value: formattedusdValues[index].toFixed(4),
      };
    }
  });
  return graphData;
};

export const fetchImportantPoints = async (
  contracts: SwapContracts,
  depositTokenDecimals: number,
  logs: any
) => {
  const stableDecimals = await contracts.stableToken.decimals();
  let usdcDeposited = 0;
  let usdcWithdrawn = 0;

  const formattedInteractions: {action: string, date: string, txHash: string, blockNumber: number, sizeChange: number, usdValue: number}[] = logs.map(event=>{
    if (["Deposit", "IncreasePosition"].includes(event.name)) {
      usdcDeposited += +ethers.utils.formatUnits(event.args.usdValue, stableDecimals);
      return {
        action: 'Deposit',
        date: new Date(event.timeStamp * 1000).toLocaleDateString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        sizeChange: +ethers.utils.formatUnits(event.args.amount, depositTokenDecimals),
        usdValue: +ethers.utils.formatUnits(event.args.usdValue, stableDecimals)
      }
    }
    if ("Withdraw"===event.name) {
      usdcWithdrawn += +ethers.utils.formatUnits(event.args.usdValue, stableDecimals);
      return {
        action: 'Withdraw',
        date: new Date(event.timeStamp * 1000).toLocaleDateString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        sizeChange: +ethers.utils.formatUnits(event.args.amount, depositTokenDecimals),
        usdValue: +ethers.utils.formatUnits(event.args.usdValue, stableDecimals)
      }
    }
    if ("PositionClose"===event.name) {
      usdcWithdrawn += +ethers.utils.formatUnits(event.args.usdValue, stableDecimals);
      return {
        action: 'Close Position',
        date: new Date(event.timeStamp * 1000).toLocaleDateString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        sizeChange: +ethers.utils.formatUnits(event.args.amount, depositTokenDecimals),
        usdValue: +ethers.utils.formatUnits(event.args.usdValue, stableDecimals)
      }
    }
    if (event.name==="Harvest") {
      usdcWithdrawn += +ethers.utils.formatUnits(event.args.usdValue, stableDecimals);
      return {
        action: 'Harvest',
        date: new Date(event.timeStamp * 1000).toLocaleDateString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        sizeChange: 0,
        usdValue: +ethers.utils.formatUnits(event.args.usdValue, stableDecimals)
      }
    }
    if (event.name==="HarvestRecompound"){
      usdcWithdrawn += +ethers.utils.formatUnits(event.args.usdValue, stableDecimals);
      return {
        action: 'Re-invest',
        date: new Date(event.timeStamp * 1000).toLocaleDateString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        sizeChange: +ethers.utils.formatUnits(event.args.amount, depositTokenDecimals),
        usdValue: +ethers.utils.formatUnits(event.args.usdValue, stableDecimals)
      }
    }
    if (event.name==="BotLiquidate") {
      usdcWithdrawn += +ethers.utils.formatUnits(event.args.usdValue, stableDecimals);
      return {
        action: `Execute order ${+event.args.liquidationIndex+1}`,
        date: new Date(event.timeStamp * 1000).toLocaleDateString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        sizeChange: +ethers.utils.formatUnits(event.args.amount, depositTokenDecimals),
        usdValue: +ethers.utils.formatUnits(event.args.usdValue, stableDecimals)
      }
    }
  })
  return { data: formattedInteractions, usdcDeposited, usdcWithdrawn };
};

export const getPriceUniversalSwap = async (contracts: SwapContracts, address: string) => {
  const token = ERC20__factory.connect(address, contracts.universalSwap.provider);
  const tokenDecimals = address != ethers.constants.AddressZero ? await token.decimals() : 18;
  const price = await contracts.universalSwap.estimateValueERC20(
    address,
    ethers.utils.parseUnits("1", tokenDecimals),
    contracts.stableToken.address
  );
  const stableDecimals = await contracts.stableToken.decimals()
  return {
    price: +ethers.utils.formatUnits(price, stableDecimals),
    decimals: tokenDecimals,
  };
};