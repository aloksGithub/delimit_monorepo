import { BigNumberish, ethers } from "ethers";
import erc20Abi from "../constants/abis/ERC20.json";
import npmAbi from "../constants/abis/INonFungiblePositionsManager.json";
import { SwapContracts, UserAssetSupplied, WantedAsset } from "../Types";
import { JsonRpcSigner, JsonRpcProvider } from "@ethersproject/providers";
import {
  ConversionStruct,
  LiquidationConditionStruct,
  PositionStruct,
  ProvidedStruct,
  SwapPointStruct,
} from "../codegen/PositionManager";
import { ERC20__factory, INonFungiblePositionsManager__factory } from "../codegen";
import { DesiredStruct } from "../codegen/UniversalSwap";
import { FetchPositionData, getPriceUniversalSwap } from "./dataFetching";
import { getSwapsAndConversionsFromProvidedAndDesired } from "./routeCalculation";

export const depositNew = async (contracts: SwapContracts, signer: JsonRpcSigner, position: PositionStruct, asset) => {
  const account = await signer.getAddress();
  let tx: ethers.ContractTransaction;
  if (asset.contract_address != ethers.constants.AddressZero) {
    const contract = ERC20__factory.connect(asset.contract_address, signer);
    const currentApproval = await contract.allowance(account, contracts.positionManager.address);
    const amount = await position.amount
    if (currentApproval.lt(amount)) {
      await contract.approve(contracts.positionManager.address, ethers.constants.MaxInt256);
      while(true) {
        const currentApproval = await contract.allowance(account, contracts.positionManager.address);
        if (currentApproval.lt(amount)) {
          await new Promise(r => setTimeout(r, 1000));
        } else {
          break
        }
      }
    }
    tx = await contracts.positionManager.deposit(position, [asset.contract_address], [position.amount]);
    await tx.wait();
  } else {
    tx = await contracts.positionManager.deposit(position, [], [], { value: position.amount });
    await tx.wait();
  }
  return tx.hash;
};

export const swap = async (
  contracts: SwapContracts,
  signer: JsonRpcSigner,
  provided: ProvidedStruct,
  desired: DesiredStruct,
  swaps: SwapPointStruct[],
  conversions: ConversionStruct[],
  expectedAssets: WantedAsset[]
) => {
  const account = await signer.getAddress();
  let ethSupplied: BigNumberish = ethers.BigNumber.from("0");
  for (const [i, token] of provided.tokens.entries()) {
    if (token != ethers.constants.AddressZero) {
      // @ts-ignore
      const assetContract = ERC20__factory.connect(token, signer);
      const tokensSupplied = await provided.amounts[i];
      const currentAllowance = await assetContract.allowance(account, contracts.universalSwap.address);
      if (currentAllowance.lt(tokensSupplied)) {
        const tx = await assetContract.approve(contracts.universalSwap.address, ethers.constants.MaxInt256);
        await tx.wait();
      }
    } else {
      ethSupplied = await provided.amounts[i];
    }
  }
  for (const [i, token] of provided.tokens.entries()) {
    if (token != ethers.constants.AddressZero) {
      // @ts-ignore
      const assetContract = ERC20__factory.connect(token, signer);
      const tokensSupplied = await provided.amounts[i];
      while(true) {
        const currentAllowance = await assetContract.allowance(account, contracts.universalSwap.address);
        if (currentAllowance.lt(tokensSupplied)) {
          await new Promise(r => setTimeout(r, 1000));
        } else {
          break
        }
      }
    }
  }
  for (const nft of provided.nfts) {
    const manager = INonFungiblePositionsManager__factory.connect(await nft.manager, signer);
    await manager.approve(contracts.universalSwap.address, nft.tokenId);
  }
  const addressZeroIndex = provided.tokens.findIndex((token) => token === ethers.constants.AddressZero);
  if (addressZeroIndex > -1) {
    provided.tokens.splice(addressZeroIndex, 1);
    provided.amounts.splice(addressZeroIndex, 1);
  }

  const tx = await contracts.universalSwap.swap(provided, swaps, conversions, desired, account, { value: ethSupplied });
  await tx.wait();
  const hash = tx.hash;
  const rc = await tx.wait();
  const event = rc.events?.find((event: any) => event.event === "Trade");
  // @ts-ignore
  const [receiver, usdValue, tokens, managers, amountsAndIds] = event!.args;
  for (const [index, asset] of expectedAssets.entries()) {
    if (index < tokens.length) {
      const amountObtained = +ethers.utils.formatUnits(amountsAndIds[index], asset.contract_decimals);
      asset.quote = asset.price * amountObtained;
      asset.expected = amountObtained;
    } else {
      const manager = INonFungiblePositionsManager__factory.connect(asset.contract_address, signer);
      const { liquidity } = await manager.positions(amountsAndIds[index]);
      const amountObtained = +ethers.utils.formatUnits(liquidity, asset.contract_decimals);
      asset.quote = asset.price * amountObtained;
      asset.expected = amountObtained;
    }
  }
  return { expectedAssets, hash };
};

export const approveAssets = async (assetsToConvert: UserAssetSupplied[], spender: string, signer: JsonRpcSigner) => {
  const provided = {
    tokens: [],
    amounts: [],
    nfts: [],
  };
  for (const asset of assetsToConvert) {
    provided.tokens.push(asset.contract_address);
    provided.amounts.push(ethers.utils.parseUnits(asset.tokensSupplied, asset.contract_decimals));
  }
  const account = await signer.getAddress();
  let ethSupplied = ethers.BigNumber.from("0");
  for (const asset of assetsToConvert) {
    const address = asset.contract_address;
    if (address != ethers.constants.AddressZero) {
      const supplied = ethers.utils.parseUnits(asset.tokensSupplied.toString(), asset.contract_decimals);
      const contract = ERC20__factory.connect(address, signer);
      const allowance = await contract.allowance(account, spender);
      if (allowance.lt(supplied)) {
        const tx = await contract.approve(spender, ethers.constants.MaxInt256);
        await tx.wait();
      }
    } else {
      ethSupplied = ethers.utils.parseUnits(asset.tokensSupplied.toString(), asset.contract_decimals);
    }
  }
  for (const [i, token] of provided.tokens.entries()) {
    if (token != ethers.constants.AddressZero) {
      const assetContract = ERC20__factory.connect(token, signer);
      const tokensSupplied = provided.amounts[i];
      while(true) {
        const currentAllowance = await assetContract.allowance(account, spender);
        if (currentAllowance.lt(tokensSupplied)) {
          await new Promise(r => setTimeout(r, 1000));
        } else {
          break
        }
      }
    }
  }
  const addressZeroIndex = provided.tokens.findIndex((token) => token === ethers.constants.AddressZero);
  if (addressZeroIndex > -1) {
    provided.tokens.splice(addressZeroIndex, 1);
    provided.amounts.splice(addressZeroIndex, 1);
  }
  return { ethSupplied, provided };
};

export const depositAgain = async (
  contracts: SwapContracts,
  signer: JsonRpcSigner,
  position: FetchPositionData,
  assetsToConvert: UserAssetSupplied[],
  chainId: number,
  slippage: number
) => {
  const {ethSupplied, provided} = await approveAssets(assetsToConvert, contracts.positionManager.address, signer)
  // const provided = {
  //   tokens: [],
  //   amounts: [],
  //   nfts: [],
  // };
  const desired = {
    outputERC20s: [],
    outputERC721s: [],
    ratios: [],
    minAmountsOut: [],
  };
  // for (const asset of assetsToConvert) {
  //   provided.tokens.push(asset.contract_address);
  //   provided.amounts.push(ethers.utils.parseUnits(asset.tokensSupplied, asset.contract_decimals));
  // }
  // const account = await signer.getAddress();
  const usdTotal = assetsToConvert.reduce((a, b) => a + b.usdcValue, 0);
  const bankAddress = position.positionData.bank;
  const bankContract = contracts.banks.find((bank) => bank.address === bankAddress);
  const underlyingTokens = await bankContract.callStatic.getUnderlyingForRecurringDeposit(
    position.positionData.bankToken
  );
  let swaps, conversions;
  if (
    underlyingTokens[0].length === 1 &&
    underlyingTokens[0][0] === provided.tokens[0] &&
    provided.tokens.length === 1
  ) {
    swaps = [];
    conversions = [];
  } else {
    const totalRatio = underlyingTokens[1].reduce((a, b) => a.add(b), ethers.BigNumber.from("0"));
    for (const [index, token] of underlyingTokens[0].entries()) {
      const { price, decimals } = await getPriceUniversalSwap(contracts, token);
      const percentageAllocated = underlyingTokens[1][index].toNumber() / totalRatio.toNumber();
      const usd = usdTotal * percentageAllocated;
      const expectedTokens = usd / price;
      const allowedSlippage = expectedTokens * (1 - slippage / 100);
      const minAmount = ethers.utils.parseUnits(allowedSlippage.toFixed(decimals).toString(), decimals);
      desired.minAmountsOut.push(minAmount);
      desired.outputERC20s.push(token);
      desired.ratios.push(underlyingTokens[1][index].toNumber());
    }
    const { swaps: s, conversions: c } = await contracts.universalSwap.preSwapCalculateSwaps(provided, desired);
    swaps = s;
    conversions = c;
  }
  // let ethSupplied = ethers.BigNumber.from("0");
  // for (const asset of assetsToConvert) {
  //   const address = asset.contract_address;
  //   if (address != ethers.constants.AddressZero) {
  //     const supplied = ethers.utils.parseUnits(asset.tokensSupplied.toString(), asset.contract_decimals);
  //     const contract = ERC20__factory.connect(address, signer);
  //     const allowance = await contract.allowance(account, contracts.positionManager.address);
  //     if (allowance.lt(supplied)) {
  //       await contract.approve(contracts.positionManager.address, ethers.constants.MaxInt256);
  //     }
  //   } else {
  //     ethSupplied = ethers.utils.parseUnits(asset.tokensSupplied.toString(), asset.contract_decimals);
  //   }
  // }
  const addressZeroIndex = provided.tokens.findIndex((token) => token === ethers.constants.AddressZero);
  if (addressZeroIndex > -1) {
    provided.tokens.splice(addressZeroIndex, 1);
    provided.amounts.splice(addressZeroIndex, 1);
  }
  const tx = await contracts.positionManager.depositInExisting(
    position.positionId,
    provided,
    swaps,
    conversions,
    desired.minAmountsOut,
    { value: ethSupplied }
  );
  await tx.wait();
  return tx.hash;
};

export const adjustLiquidationPoints = async (
  contracts: SwapContracts,
  positionId: BigNumberish,
  liquidationConditions: LiquidationConditionStruct[]
) => {
  const tx = await contracts.positionManager.adjustLiquidationPoints(positionId, liquidationConditions);
  await tx.wait();
  return tx.hash;
};

export const harvest = async (contracts: SwapContracts, positionId: BigNumberish) => {
  const tx = await contracts.positionManager.harvestRewards(positionId);
  await tx.wait();
  return tx.hash;
};

export const compound = async (
  contracts: SwapContracts,
  positionId: BigNumberish,
  positionInfo,
  slippage: number,
  chainId: number
) => {
  const { rewards, rewardAmounts } = await contracts.managerHelper.getPositionRewards(positionId);
  const provided = {
    tokens: [],
    amounts: [],
    nfts: [],
  };
  const desired = {
    outputERC20s: [],
    outputERC721s: [],
    ratios: [],
    minAmountsOut: [],
  };
  for (const [index, reward] of rewards.entries()) {
    provided.tokens.push(reward);
    provided.amounts.push(rewardAmounts[index]);
  }
  const usdValues = [];
  for (const [index, reward] of rewards.entries()) {
    const { price, decimals } = await getPriceUniversalSwap(contracts, reward);
    const amount = +ethers.utils.formatUnits(rewardAmounts[index].toString(), decimals);
    const usdValue = amount * price;
    usdValues.push(usdValue);
  }

  const usdSupplied = usdValues.reduce((a, b) => a + b, 0);
  const bankId = positionInfo.bankId.toNumber();
  const bankContract = contracts.banks[bankId];
  const [underlying, ratios] = await bankContract.getUnderlyingForRecurringDeposit(positionInfo.bankToken);
  const totalRatio = ratios.reduce((a, b) => a.add(b), ethers.BigNumber.from("0"));
  for (const [index, token] of underlying.entries()) {
    desired.outputERC20s.push(token);
    desired.ratios.push(ratios[index]);
    const { price, decimals } = await getPriceUniversalSwap(contracts, token);
    const percentageAllocated = ratios[index].toNumber() / totalRatio.toNumber();
    const usd = usdSupplied * percentageAllocated;
    const expectedTokens = usd / price;
    const allowedSlippage = expectedTokens * (1 - slippage / 100);
    const minAmount = ethers.utils.parseUnits(allowedSlippage.toFixed(decimals).toString(), decimals);
    desired.minAmountsOut.push(minAmount);
  }
  const { swaps, conversions } = await getSwapsAndConversionsFromProvidedAndDesired(contracts, provided, desired);
  const tx = await contracts.positionManager.harvestAndRecompound(
    positionId,
    swaps,
    conversions,
    desired.minAmountsOut
  );
  await tx.wait();
  return tx.hash;
};

export const withdraw = async (contracts: SwapContracts, positionId: BigNumberish, amount: BigNumberish) => {
  const tx = await contracts.positionManager.withdraw(positionId, amount);
  await tx.wait();
  return tx.hash;
};

export const close = async (contracts: SwapContracts, positionId: BigNumberish) => {
  const tx = await contracts.positionManager.close(positionId, '');
  await tx.wait();
  return tx.hash;
};
