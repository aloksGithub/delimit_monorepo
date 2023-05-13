import { formatUnits, parseUnits } from "@ethersproject/units";
import { useWeb3React } from "@web3-react/core";
import { BigNumber, ethers } from "ethers";
import { useEffect, useState } from "react";
import { ConversionStruct, ProvidedStruct, SwapPointStruct } from "../codegen/PositionManager";
import { useAppContext } from "../components/Provider";
import { UserAssetSupplied, WantedAsset } from "../Types";
import { findMultipleSwaps } from "../contractCalls/routeCalculation";
import { DesiredStruct } from "../codegen/SwapHelper";
import { ProvidedStructOutput } from "../codegen/UniversalSwap";

const useUniversalSwapPreSwap = ({
  assetsToConvert,
  wantedAssets,
  parentLoading,
  triggerError,
}: {
  assetsToConvert: UserAssetSupplied[];
  wantedAssets: WantedAsset[];
  parentLoading: boolean;
  triggerError: (error: string) => void;
}) => {
  const { contracts } = useAppContext();
  const [loadingText, setLoadingText] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [swaps, setSwaps] = useState<SwapPointStruct[]>();
  const [provided, setProvided] = useState<ProvidedStruct>();
  const [desired, setDesired] = useState<DesiredStruct>();
  const [findSwapsData, setFindSwapsData] = useState<{
    tokens: string[];
    amounts: BigNumber[];
    inputTokenValues: BigNumber[];
    conversions: ConversionStruct[];
    conversionUnderlying: string[];
    conversionUnderlyingValues: BigNumber[];
  }>();

  const onError = (message: string) => {
    setLoading(false);
    setLoadingText(undefined);
    triggerError(message);
  };

  const sanityCheck = () => {
    if (!contracts) {
      onError("Looks like Delimit contracts have not yet been deployed on this chain, please switch to BSC");
      return false;
    }
    const usdSupplied = assetsToConvert.reduce((a, b) => a + (b.usdcValue || 0), 0);
    if (usdSupplied <= 0) {
      onError("No USD supplied");
      return false;
    }
    let percentageTotal = 0;
    for (let i = 0; i < wantedAssets.length; i++) {
      const asset = wantedAssets[i];
      percentageTotal += +asset.percentage;
      if (!("contract_address" in asset)) {
        onError(`Please select asset for wanted asset ${i + 1}`);
        return false;
      }
      if (!asset.percentage) {
        onError(`Please specify percentage for wanted asset ${i + 1}`);
        return false;
      }
      if (asset.percentage === 0) {
        onError(`Percentage for wanted asset ${i + 1} is 0`);
        return false;
      }
    }
    if (percentageTotal != 100) {
      onError("Total percentage is not 100%");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!parentLoading) return;
    if (!sanityCheck()) return;
    setLoadingText("Calculating Underlying");
    setLoading(true);
    const provided = {
      tokens: assetsToConvert.map((asset) => asset.contract_address),
      amounts: assetsToConvert.map((asset) => parseUnits(asset.tokensSupplied, asset.contract_decimals)),
      nfts: [],
    };
    setProvided(provided);
    const desired: { outputERC20s: string[]; outputERC721s: any[]; ratios: number[]; minAmountsOut: BigNumber[] } = {
      outputERC20s: [],
      outputERC721s: [],
      ratios: [],
      minAmountsOut: [],
    };
    for (const asset of wantedAssets) {
      desired.outputERC20s.push(asset.contract_address);
      desired.ratios.push(Math.floor(asset.percentage * 10000));
      desired.minAmountsOut.push(parseUnits(asset.minOut.toFixed(asset.contract_decimals), asset.contract_decimals));
    }
    setDesired(desired);
    const simplify = async () => {
      const providedModified: ProvidedStructOutput = JSON.parse(JSON.stringify(provided))
      providedModified.tokens = providedModified.tokens.map(token=>token===ethers.constants.AddressZero?contracts.networkToken.address:token)
      const {simplifiedTokens, simplifiedAmounts} = await contracts.providedHelper.simplifyWithoutWrite(providedModified)
      providedModified.amounts = simplifiedAmounts.map(amount=>amount.sub(amount.mul(100).div(100000)))
      providedModified.tokens = simplifiedTokens
      providedModified.nfts = []
      const [tokens, amounts, inputTokenValues, conversions, conversionUnderlying, conversionUnderlyingValues] =
        await contracts.universalSwap.preSwapCalculateUnderlying(providedModified, desired);
      setFindSwapsData({
        tokens,
        amounts,
        inputTokenValues,
        conversions,
        conversionUnderlying,
        conversionUnderlyingValues,
      });
    };
    simplify().catch((error) => {
      console.log(error);
      onError("Unable to get underlying for assets");
    });
  }, [parentLoading]);

  useEffect(() => {
    if (!parentLoading) return;
    if (!sanityCheck()) return;
    if (!findSwapsData) return;
    setLoadingText("Calculating Routes");
    findMultipleSwaps(
      contracts,
      findSwapsData.tokens,
      findSwapsData.amounts,
      findSwapsData.inputTokenValues,
      findSwapsData.conversionUnderlying,
      findSwapsData.conversionUnderlyingValues
    )
      .then((swaps) => {
        setSwaps(swaps);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
        onError("Unable to calculate routes");
      });
  }, [findSwapsData]);
  return { data: { swaps, conversions: findSwapsData?.conversions, provided, desired }, loading, loadingText };
};

export default useUniversalSwapPreSwap;
