import { formatUnits } from "@ethersproject/units";
import { useEffect, useState } from "react";
import { useAppContext } from "../components/Provider";
import { UserAssetSupplied, WantedAsset } from "../Types";
import useUniversalSwapPreSwap from "./useUniversalSwapPreSwap";

const useUniversalSwapGetAmounts = ({
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
  const {
    contracts,
    slippageControl: { slippage },
  } = useAppContext();
  const [loadingText, setLoadingText] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    data: swapData,
    loading: childLoading,
    loadingText: preSwapLoadingText,
  } = useUniversalSwapPreSwap({ assetsToConvert, wantedAssets, parentLoading, triggerError });
  const [expectedAssets, setExpectedAssets] = useState<WantedAsset[]>();

  const onError = (message: string) => {
    setLoading(false);
    setLoadingText("");
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
    if (expectedAssets && expectedAssets.length === wantedAssets.length) {
      for (const [index, asset] of wantedAssets.entries()) {
        const minOut = ((asset.expected || 0) * (100 - slippage)) / 100;
        expectedAssets[index].minOut = minOut;
      }
      setExpectedAssets(expectedAssets);
    }
  }, [slippage]);

  useEffect(() => {
    if (!parentLoading) return;
    if (!sanityCheck()) return;
    setLoadingText("Calculating Expected");
    setLoading(true);
    const getAmountsOut = async () => {
      const { amounts, expectedUSDValues } = await contracts.universalSwap.getAmountsOutWithSwaps(
        swapData.provided,
        swapData.desired,
        swapData.swaps,
        swapData.conversions
      );
      const stableDecimals = await contracts.stableToken.decimals();
      const expectedAssets: WantedAsset[] = wantedAssets.map((asset, index) => {
        return {
          ...asset,
          expected: +formatUnits(amounts[index], asset.contract_decimals),
          quote: +formatUnits(expectedUSDValues[index], stableDecimals),
        };
      });
      setExpectedAssets(expectedAssets);
      setLoadingText("");
      setLoading(false);
    };
    getAmountsOut().catch((error) => {
      console.log(error);
      onError("Unable to calculate amounts out");
    });
  }, [swapData.swaps]);
  return {
    data: { ...swapData, expectedAssets },
    loading: childLoading || loading,
    loadingText: loadingText || preSwapLoadingText,
  };
};

export default useUniversalSwapGetAmounts;
