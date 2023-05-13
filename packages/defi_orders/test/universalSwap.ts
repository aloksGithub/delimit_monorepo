import { expect } from "chai";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { deployments, ethers } from "hardhat";
import { UniversalSwap, IERC20, IOracle, ISwapper } from "../typechain-types";
import { ProvidedStruct } from "../typechain-types/contracts/PositionsManager";
import { DesiredStruct } from "../typechain-types/contracts/UniversalSwap";
import {
  addresses,
  getNetworkToken,
  getNFT,
  isRoughlyEqual,
  getNearestUsableTick,
  calculateRoute,
} from "../utils";
import { SwapContracts } from "../Types";
import { ProvidedHelper } from "../typechain-types/contracts/SwapHelper.sol";

// @ts-ignore
const networkAddresses = addresses[hre.network.name];

const compareComputedWithActual = async (computed: any[], actual: any[], manager: string, numERC20s: number) => {
  for (let i = 0; i < numERC20s; i++) {
    isRoughlyEqual(computed[i], actual[i], 100);
  }
  if (!manager) return;
  const managerContract = await ethers.getContractAt("INonfungiblePositionManager", manager);
  for (let i = numERC20s; i < computed.length; i++) {
    const tokenId = actual[i];
    const { liquidity } = await managerContract.positions(tokenId);
    isRoughlyEqual(liquidity, computed[i], 500);
  }
};

describe("Universal swap", async function () {
  let universalSwap: UniversalSwap;
  let contracts: SwapContracts;
  let owners: any[];
  let networkTokenContract: IERC20;

  const performMultiSwap = async (provided: ProvidedStruct, desired: DesiredStruct) => {
    const addressZeroIndex = provided.tokens.findIndex((token) => token === ethers.constants.AddressZero);
    const etherSupplied = addressZeroIndex > -1 ? provided.amounts[addressZeroIndex] : "0";
    const { swaps: swapsFromContract, conversions: conversionsFromContract } = await universalSwap.getAmountsOut(
      provided,
      desired
    );
    const { swaps, conversions } = await calculateRoute(contracts, provided, desired);
    for (const [index, swap] of swaps.entries()) {
      const swapFromContract = swapsFromContract[index];
      for (const key of Object.keys(swap)) {
        if (key != "slippage" && key != "amountOut" && key != "valueOut") {
          // @ts-ignore
          expect(JSON.stringify(swap[key])).to.equal(JSON.stringify(swapFromContract[key]));
        }
      }
    }
    for (const [index, conversion] of conversions.entries()) {
      const conversionFromContract = conversionsFromContract[index];
      for (const key of Object.keys(conversion)) {
        // @ts-ignore
        expect(JSON.stringify(conversion[key])).to.equal(JSON.stringify(conversionFromContract[key]));
      }
    }
    const { amounts } = await universalSwap.getAmountsOutWithSwaps(provided, desired, swaps, conversions);
    for (const [i, asset] of provided.tokens.entries()) {
      if (asset != constants.AddressZero) {
        const contract = await ethers.getContractAt("ERC20", await asset);
        await contract.approve(universalSwap.address, provided.amounts[i]);
      }
    }
    for (const nft of provided.nfts) {
      const manager = await ethers.getContractAt("INonfungiblePositionManager", await nft.manager);
      await manager.approve(universalSwap.address, nft.tokenId);
    }
    const tx = await universalSwap.swap(provided, swaps, conversions, desired, owners[0].address, {
      value: etherSupplied,
    });
    const rc = await tx.wait();
    const event = rc.events?.find((event: any) => event.event === "Trade");
    // @ts-ignore
    const [receiver, usdValue, tokens, managers, amountsAndIds] = event!.args;
    const ids = amountsAndIds.slice(tokens.length);
    let nextInputERC721sPromises = await desired.outputERC721s.map(async (nft: any, index: number) => {
      const managerContract = await ethers.getContractAt("INonfungiblePositionManager", nft.manager);
      await managerContract.approve(universalSwap.address, ids[index]);
      const position = await managerContract.positions(ids[index]);
      return { ...nft, tokenId: ids[index], liquidity: position.liquidity };
    });
    const nextInputERC721s = await Promise.all(nextInputERC721sPromises);
    await compareComputedWithActual(amounts, amountsAndIds, networkAddresses.NFTManagers[0], tokens.length);
    return { tokens: desired.outputERC20s, amounts: amountsAndIds.slice(0, tokens.length), nfts: nextInputERC721s };
  };

  before(async function () {
    await deployments.fixture()
    const universalSwapAddress = (await deployments.get('UniversalSwap')).address;
    universalSwap = await ethers.getContractAt("UniversalSwap", universalSwapAddress)
    owners = await ethers.getSigners();
    networkTokenContract = await ethers.getContractAt("IERC20", networkAddresses.networkToken);
    await networkTokenContract.transfer(owners[1].address, networkTokenContract.balanceOf(owners[0].address));
    const { wethContract } = await getNetworkToken(owners[0], "10.0");
    await wethContract.connect(owners[0]).approve(universalSwap.address, ethers.utils.parseEther("100"));

    const oracleAddress = await universalSwap.oracle();
    const oracle: IOracle = await ethers.getContractAt("IOracle", oracleAddress);
    const swapperAddresses = await universalSwap.getSwappers();
    const swappers: ISwapper[] = await Promise.all(
      swapperAddresses.map(async (address) => await ethers.getContractAt("ISwapper", address))
    );
    const providedHelper: ProvidedHelper = await ethers.getContractAt("ProvidedHelper", await universalSwap.providedHelper())
    contracts = { universalSwap, oracle, swappers, networkToken: networkTokenContract, providedHelper };
  });
  it("Swaps tokens correctly without losing too much equity", async function () {
    let currentToken = networkAddresses.networkToken;
    const startingBalance = await networkTokenContract.balanceOf(owners[0].address);
    let provided = { tokens: [currentToken], amounts: [startingBalance], nfts: [] };
    const tokensToSwapThrough: string[] = networkAddresses.universwalSwapTestingTokens;
    tokensToSwapThrough.push(networkAddresses.networkToken);
    for (const token of tokensToSwapThrough) {
      // @ts-ignore
      provided = await performMultiSwap(provided, {
        outputERC20s: [token],
        outputERC721s: [],
        ratios: [1],
        minAmountsOut: [0],
      });
    }
    const endingbalance = await networkTokenContract.balanceOf(owners[0].address);
    isRoughlyEqual(endingbalance, startingBalance, 500);
  });
  it("Swaps for uniswap nft", async function () {
    const getNFTForPool = async (pool: string) => {
      const managerAddress = networkAddresses.NFTManagers[0];
      const startingBalance = await networkTokenContract.balanceOf(owners[0].address);
      const id = await getNFT(universalSwap, "1", managerAddress, pool, owners[0]);
      const manager = await ethers.getContractAt("INonfungiblePositionManager", managerAddress);
      const result = await manager.positions(id);
      const liquidity = result[7];
      expect(liquidity).to.greaterThan(0);
      expect(id).to.greaterThan(0);
      await manager.approve(universalSwap.address, id);
      await universalSwap
        .connect(owners[0])
        .swap(
          { tokens: [], amounts: [], nfts: [{ pool, manager: managerAddress, liquidity, tokenId: id, data: [] }] },
          [],
          [],
          { outputERC20s: [networkAddresses.networkToken], outputERC721s: [], ratios: [1], minAmountsOut: [0] },
          owners[0].address
        );
      const endingbalance = await networkTokenContract.balanceOf(owners[0].address);
      isRoughlyEqual(startingBalance, endingbalance);
    };
    for (const pool of networkAddresses.nftBasaedPairs) {
      await getNFTForPool(pool);
    }
  });
  it("Performs multi-swap", async function () {
    const startingBalance = await networkTokenContract.balanceOf(owners[0].address);
    const adminBalanceBegin = await owners[0].getBalance();
    const erc20s: string[] = networkAddresses.universwalSwapTestingTokens;
    let erc721s: any = networkAddresses.nftBasaedPairs;
    const erc20sStep1 = erc20s.slice(0, Math.floor(erc20s.length / 2));
    const erc20sStep2 = erc20s.slice(Math.floor(erc20s.length / 2), erc20s.length);
    erc721s = erc721s.map(async (pool: string) => {
      const abi = ethers.utils.defaultAbiCoder;
      const poolContract = await ethers.getContractAt("IUniswapV3Pool", pool);
      const { tick } = await poolContract.slot0();
      const tickSpacing = await poolContract.tickSpacing();
      const nearestTick = getNearestUsableTick(tick, tickSpacing);
      const data = abi.encode(
        ["int24", "int24", "uint256", "uint256"],
        [nearestTick - 2500 * tickSpacing, nearestTick + 20 * tickSpacing, 0, 0]
      );
      return { pool, manager: networkAddresses.NFTManagers[0], tokenId: 0, liquidity: 0, data };
    });
    erc721s = await Promise.all(erc721s);
    const erc721sStep1 = erc721s.slice(0, Math.floor(erc721s.length / 2));
    const erc721sStep2 = erc721s.slice(Math.floor(erc721s.length / 2), erc721s.length);
    const ratiosStep1 = [];
    for (let i = 0; i < erc20sStep1.length + erc721sStep1.length; i++) {
      ratiosStep1.push(100);
    }
    const ratiosStep2 = [];
    for (let i = 0; i < erc20sStep2.length + erc721sStep2.length; i++) {
      ratiosStep2.push(100);
    }
    const minAmountsStep1 = Array(erc20sStep1.length).fill(0);
    const minAmountsStep2 = Array(erc20sStep2.length).fill(0);
    await networkTokenContract.approve(universalSwap.address, await networkTokenContract.balanceOf(owners[0].address));

    let nextProvided = await performMultiSwap(
      {
        tokens: [networkAddresses.networkToken],
        amounts: [await networkTokenContract.balanceOf(owners[0].address)],
        nfts: [],
      },
      { outputERC20s: erc20sStep1, outputERC721s: erc721sStep1, ratios: ratiosStep1, minAmountsOut: minAmountsStep1 }
    );

    nextProvided = await performMultiSwap(nextProvided, {
      outputERC20s: erc20sStep2,
      outputERC721s: erc721sStep2,
      ratios: ratiosStep2,
      minAmountsOut: minAmountsStep2,
    });

    nextProvided = await performMultiSwap(nextProvided, {
      outputERC20s: [networkAddresses.networkToken],
      outputERC721s: [],
      ratios: [1],
      minAmountsOut: [0],
    });

    const balanceFinal = await networkTokenContract.balanceOf(owners[0].address);
    isRoughlyEqual(startingBalance, balanceFinal, 500);
    console.log(`Slippage: ${startingBalance.sub(balanceFinal).mul("10000").div(startingBalance).toNumber() / 100}%`);
    const adminBalanceEnd = await owners[0].getBalance();
    const gasCost = adminBalanceBegin.sub(adminBalanceEnd);
    console.log(`Gas cost: ${ethers.utils.formatEther(gasCost)}`);
  });
  it("Swaps network token and wrapped network token in the same transaction", async function () {
    const erc20s: string[] = networkAddresses.universwalSwapTestingTokens;
    let erc721s: any = networkAddresses.nftBasaedPairs;
    const erc20sStep1 = erc20s.slice(0, Math.floor(erc20s.length / 2));
    const erc20sStep2 = erc20s.slice(Math.floor(erc20s.length / 2), erc20s.length);
    erc721s = erc721s.map(async (pool: string) => {
      const abi = ethers.utils.defaultAbiCoder;
      const poolContract = await ethers.getContractAt("IUniswapV3Pool", pool);
      const { tick } = await poolContract.slot0();
      const tickSpacing = await poolContract.tickSpacing();
      const nearestTick = getNearestUsableTick(tick, tickSpacing);
      const data = abi.encode(
        ["int24", "int24", "uint256", "uint256"],
        [nearestTick - 2500 * tickSpacing, nearestTick + 20 * tickSpacing, 0, 0]
      );
      return { pool, manager: networkAddresses.NFTManagers[0], tokenId: 0, liquidity: 0, data };
    });
    erc721s = await Promise.all(erc721s);
    const erc721sStep1 = erc721s.slice(0, Math.floor(erc721s.length / 2));
    const erc721sStep2 = erc721s.slice(Math.floor(erc721s.length / 2), erc721s.length);
    const ratiosStep1 = [];
    for (let i = 0; i < erc20sStep1.length + erc721sStep1.length; i++) {
      ratiosStep1.push(100);
    }
    const ratiosStep2 = [];
    for (let i = 0; i < erc20sStep2.length + erc721sStep2.length; i++) {
      ratiosStep2.push(100);
    }
    const minAmountsStep1 = Array(erc20sStep1.length).fill(0);
    await networkTokenContract.approve(universalSwap.address, await networkTokenContract.balanceOf(owners[0].address));

    let nextProvided = await performMultiSwap(
      {
        tokens: [networkAddresses.networkToken, constants.AddressZero],
        amounts: [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")],
        nfts: [],
      },
      { outputERC20s: erc20sStep1, outputERC721s: erc721sStep1, ratios: ratiosStep1, minAmountsOut: minAmountsStep1 }
    );

    nextProvided = await performMultiSwap(nextProvided, {
      outputERC20s: [networkAddresses.networkToken, ethers.constants.AddressZero],
      outputERC721s: [],
      ratios: [1, 1],
      minAmountsOut: [0, 0],
    });

    expect(nextProvided.amounts[0]).to.greaterThanOrEqual(parseEther("1").mul("97").div("100"));
    expect(nextProvided.amounts[1]).to.greaterThanOrEqual(parseEther("1").mul("97").div("100"));
    // isRoughlyEqual(nextProvided.amounts[0], ethers.utils.parseEther("1"), 100)
    // isRoughlyEqual(nextProvided.amounts[1], ethers.utils.parseEther("1"), 100)

    nextProvided = await performMultiSwap(
      { tokens: [networkAddresses.networkToken], amounts: [ethers.utils.parseEther("1")], nfts: [] },
      {
        outputERC20s: [...erc20sStep1, ethers.constants.AddressZero],
        outputERC721s: erc721sStep1,
        ratios: [...ratiosStep1, 100],
        minAmountsOut: [...minAmountsStep1, 0],
      }
    );

    isRoughlyEqual(
      nextProvided.amounts[nextProvided.amounts.length - 1],
      ethers.utils.parseEther((1 / (ratiosStep1.length + 1)).toString())
    );

    nextProvided = await performMultiSwap(nextProvided, {
      outputERC20s: [networkAddresses.networkToken],
      outputERC721s: [],
      ratios: [100],
      minAmountsOut: [0],
    });
    isRoughlyEqual(nextProvided.amounts[0], ethers.utils.parseEther("1"), 500);
    // expect(nextProvided.amounts[0]).to.greaterThan(ethers.utils.parseEther("1").mul(95).div(100));
  });
  it("Router doesn't have leftover funds", async function () {
    const usualSuspects = [...networkAddresses.commonPoolTokens];
    let lostFunds = 0;
    for (const suspect of usualSuspects) {
      const contract = await ethers.getContractAt("IERC20", suspect);
      const balance = await contract.balanceOf(universalSwap.address);
      const usdValue = await universalSwap.estimateValueERC20(suspect, balance, networkAddresses.preferredStable);
      const stableToken = await ethers.getContractAt("ERC20", networkAddresses.preferredStable);
      const stableDecimals = await stableToken.decimals();
      lostFunds += +ethers.utils.formatUnits(usdValue, stableDecimals);
    }
    console.log(`$${lostFunds} stuck in router`);
  });
});
