import { useEffect, useState } from "react";
import { useAppContext } from "../components/Provider";
import { PositionStructOutput } from "../codegen/PositionManager";
import { Asset, UserAsset } from "../Types";
import { useWeb3React } from "@web3-react/core";
import { getLogoUrl, nativeTokens, nFormatter, supportedChainAssets } from "../utils";
import { BigNumber, ethers } from "ethers";
import { ERC20__factory } from "../codegen";
import { parseUnits } from "ethers/lib/utils";
import { BankTokenInfoStructOutput } from "../codegen/ManagerHelper";

const usePosition = (positionId: number, refresh: boolean) => {
  const { provider, account } = useWeb3React();
  const { chainId, contracts } = useAppContext();
  const [asset, setAsset] = useState<Asset | undefined>();
  const [underlying, setUnderlying] = useState<UserAsset[] | undefined>();
  const [positionInfo, setPositionInfo] = useState<PositionStructOutput | undefined>();
  const [bankTokenInfo, setBankTokenInfo] = useState<BankTokenInfoStructOutput | undefined>();
  const [underlyingData, setUnderlyingData] = useState<
    { tokens: string[]; amounts: BigNumber[]; values: BigNumber[] } | undefined
  >();
  const [rewardData, setRewardData] = useState<
    { tokens: string[]; amounts: BigNumber[]; values: BigNumber[] } | undefined
  >();
  const [stableDecimals, setStableDecimals] = useState<number | undefined>();
  const [rewards, setRewards] = useState<UserAsset[] | undefined>(undefined);
  const [usdcValue, setUsdcValue] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getAssetData = async () => {
      if (bankTokenInfo && bankTokenInfo?.lpToken != ethers.constants.AddressZero) {
        const contract = ERC20__factory.connect(bankTokenInfo.lpToken, provider);
        const symbol = await contract.symbol();
        const name = await contract.name();
        setAsset({
          contract_name: name,
          chain_id: chainId,
          contract_decimals: undefined,
          underlying: [],
          protocol_name: undefined,
          contract_ticker_symbol: symbol,
          contract_address: bankTokenInfo.lpToken,
          logo_url: getLogoUrl(name, contract.address, chainId),
        });
      } else {
        setAsset(nativeTokens[chainId]);
      }
    };
    getAssetData();
  }, [bankTokenInfo]);

  useEffect(() => {
    const fetchUnderlying = async (token: string, index: number) => {
      let name: string;
      let decimals: number;
      let symbol: string;
      if (token != ethers.constants.AddressZero) {
        const contract = ERC20__factory.connect(token, provider);
        symbol = await contract.symbol();
        name = await contract.name();
        decimals = await contract.decimals();
      } else {
        const networkAsset = supportedChainAssets[chainId].find(
          (asset) => asset.contract_address === ethers.constants.AddressZero
        );
        name = networkAsset.contract_name;
        symbol = networkAsset.contract_ticker_symbol;
        decimals = networkAsset.contract_decimals;
      }
      const amount = ethers.utils.formatUnits(underlyingData.amounts[index], decimals);
      const usdValue = +ethers.utils.formatUnits(underlyingData.values[index], stableDecimals);
      return {
        contract_name: name,
        contract_address: token,
        contract_ticker_symbol: symbol,
        contract_decimals: decimals,
        quote: usdValue,
        quote_rate: 0,
        chain_id: chainId,
        balance: underlyingData.amounts[index].toString(),
        formattedBalance: amount,
        underlying: [],
        protocol_name: "",
        logo_url: getLogoUrl(name, token, chainId),
      };
    };
    if (underlyingData?.tokens) {
      Promise.all(underlyingData?.tokens?.map((token, index) => fetchUnderlying(token, index))).then((underlying) => {
        setUnderlying(underlying);
        setLoading(false);
      });
    }
  }, [underlyingData]);

  useEffect(() => {
    const fetchRewards = async (token: string, index: number) => {
      const contract = ERC20__factory.connect(token, provider);
      const symbol = await contract.symbol();
      const name = await contract.name();
      const decimals = await contract.decimals();
      const amount = ethers.utils.formatUnits(rewardData.amounts[index], decimals);
      const usdValue = +ethers.utils.formatUnits(rewardData.values[index], stableDecimals);
      return {
        contract_name: name,
        contract_address: token,
        contract_ticker_symbol: symbol,
        contract_decimals: decimals,
        quote: usdValue,
        quote_rate: 0,
        chain_id: chainId,
        balance: rewardData.amounts[index].toString(),
        formattedBalance: amount,
        underlying: [],
        protocol_name: "",
        logo_url: getLogoUrl(name, contract.address, chainId),
      };
    };
    if (rewardData?.tokens) {
      Promise.all(rewardData?.tokens.map((token, index) => fetchRewards(token, index))).then((rewards) => {
        setRewards(rewards);
      });
    }
  }, [rewardData]);

  useEffect(() => {
    setLoading(true);
    setUnderlying(undefined);
    setRewards(undefined);
    contracts?.managerHelper.getPosition(positionId).then(async (positionData) => {
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
      setPositionInfo(position);
      const stableDecimals = await contracts.stableToken.decimals();
      const usd = ethers.utils.formatUnits(usdValue, stableDecimals);
      setStableDecimals(stableDecimals);
      setUsdcValue(nFormatter(usd, 3));
      setBankTokenInfo(bankTokenInfo);
      setUnderlyingData({ tokens: underlyingTokens, amounts: underlyingAmounts, values: underlyingValues });
      setRewardData({ tokens: rewardTokens, amounts: rewardAmounts, values: rewardValues });
    });
  }, [positionId, refresh, provider, account]);

  return { data: { positionInfo, asset, underlying, rewards, usdcValue }, loading };
};

export default usePosition;
