import { Flex, useColorModeValue, Text, Box } from "@chakra-ui/react";
import { useWeb3React } from "@web3-react/core";
import { useEffect, useState } from "react";
import { FetchPositionData, getPriceUniversalSwap } from "../contractCalls/dataFetching";
import { approveAssets, depositAgain } from "../contractCalls/transactions";
import { UserAssetSupplied, defaultUserAssetSupplied, WantedAsset, LiquidationCondition } from "../Types";
import { getBlockExplorerUrlTransaction } from "../utils";
import { PrimaryButton } from "./Buttons";
import { useAppContext } from "./Provider";
import { SupplyAssets } from "./selectAssets";
import useUniversalSwapPreSwap from "../hooks/useUniversalSwapPreSwap";
import { BigNumber } from "ethers";

const DepositModal = ({
  position,
  refreshData,
  closeSelf,
  liquidationConditions
}: {
  position: FetchPositionData;
  refreshData: Function;
  closeSelf: Function;
  liquidationConditions: LiquidationCondition[]
}) => {
  const [assetsToConvert, setAssetsToConvert] = useState<UserAssetSupplied[]>([defaultUserAssetSupplied]);
  const [wantedAssets, setWantedAssets] = useState<WantedAsset[]>();
  const {
    contracts,
    chainId,
    slippageControl: { slippage },
    onError,
  } = useAppContext();
  const { provider, account } = useWeb3React();
  const signer = provider.getSigner();
  const { successModal } = useAppContext();
  const [isDepositing, setDepositing] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [calculatePreSwap, setCalculatePreSwap] = useState(false);
  const [violatedCondition, setViolatedCondition] = useState<number>()

  useEffect(() => {
    let violatedIndex = -1
    for (const [index, condition] of liquidationConditions.entries()) {
      if (!condition.lessThan) {
        if (condition.watchedAsset.contract_address===contracts.positionManager.address) {
          const liquidateAt = condition.liquidationPoint
          if (liquidateAt<position.usdcValue+assetsToConvert.reduce((a, b) => a + b.usdcValue, 0)) {
            violatedIndex = index
          }
        }
      }
    }
    if (violatedIndex!=-1) {
      setViolatedCondition(violatedIndex+1)
    } else {
      setViolatedCondition(undefined)
    }
  }, [assetsToConvert])
  
  const triggerError = (error: any) => {
    console.log(error);
    setDepositing(false);
    onError(error);
  };

  const {
    data: swapData,
    loading: childLoading,
    loadingText: preSwapLoadingText,
  } = useUniversalSwapPreSwap({
    assetsToConvert,
    wantedAssets,
    parentLoading: calculatePreSwap,
    triggerError,
  });

  useEffect(() => {
    if (isDepositing) {
      const getUnderlying = async () => {
        const desired: WantedAsset[] = [];
        const usdTotal = assetsToConvert.reduce((a, b) => a + b.usdcValue, 0);
        const bankAddress = position.positionData.bank;
        const bankContract = contracts.banks.find((bank) => bank.address === bankAddress);
        const underlyingTokens = await bankContract.callStatic.getUnderlyingForRecurringDeposit(
          position.positionData.bankToken
        );
        const totalRatio = underlyingTokens[1].reduce((a, b) => a.add(b), BigNumber.from("0"));
        for (const [index, token] of underlyingTokens[0].entries()) {
          const { price, decimals } = await getPriceUniversalSwap(contracts, token);
          const percentageAllocated = underlyingTokens[1][index].toNumber() / totalRatio.toNumber();
          const usd = usdTotal * percentageAllocated;
          const expectedTokens = usd / price;
          const allowedSlippage = expectedTokens * (1 - slippage / 100);
          const wanted: WantedAsset = {
            percentage: percentageAllocated * 100,
            expected: expectedTokens,
            minOut: allowedSlippage,
            price,
            quote: usd,
            contract_name: "",
            contract_ticker_symbol: "",
            contract_address: token,
            contract_decimals: decimals,
            underlying: [],
            logo_url: "",
            protocol_name: "",
            chain_id: chainId,
          };
          desired.push(wanted);
        }
        setWantedAssets(desired);
        setLoadingText("");
        setCalculatePreSwap(true);
      };
      setLoadingText("Calculating ratios");
      getUnderlying().catch((error) => triggerError(error));
    }
  }, [isDepositing]);

  const onSuccess = (hash: string) => {
    setDepositing(false);
    refreshData();
    closeSelf();
    successModal(
      "Deposit Successful",
      <Text>
        Asset was deposited successfully, View{" "}
        <a href={getBlockExplorerUrlTransaction(chainId, hash)} target="_blank" rel="noopener noreferrer">
          <Text as="u" textColor={"blue.500"}>
            transaction
          </Text>
        </a>
        &nbsp;on block explorer.
      </Text>
    );
  };

  useEffect(() => {
    if (!childLoading && swapData.desired) {
      setLoadingText("Approving");
      approveAssets(assetsToConvert, contracts.positionManager.address, signer)
        .then(({ ethSupplied, provided }) => {
          setLoadingText("Depositing");
          contracts.positionManager
            .depositInExisting(
              position.positionId,
              provided,
              swapData.swaps,
              swapData.conversions,
              swapData.desired.minAmountsOut,
              { value: ethSupplied }
            )
            .then(async (tx) => {
              await tx.wait()
              onSuccess(tx.hash)
            })
            .catch((error) => triggerError(error));
        })
        .catch((error) => triggerError(error));
    }
  }, [swapData.swaps]);

  const supply = async () => {
    setDepositing(true);
  };

  return (
    <Flex bgColor={useColorModeValue("white", "gray.900")} alignItems={"center"} direction={"column"} width={"100%"}>
      {
        violatedCondition?
        <Flex width={'100%'} zIndex={0} mb={4} position='relative' borderRadius={'lg'} border='1px' borderColor={'yellow.200'}>
          <Flex zIndex={1} bgColor={'yellow'} opacity='0.1' position={'absolute'} width='100%' height={'100%'}></Flex>
          <Text zIndex={2} m='2'>Warning: Placing this order will trigger limit order {violatedCondition}</Text>
        </Flex>:<></>
      }
      <Box width={"100%"}>
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <Flex width={"100%"} justifyContent={"center"}>
            <SupplyAssets assetsToConvert={assetsToConvert} setAssetsToConvert={setAssetsToConvert} />
          </Flex>
        </div>
        <Flex mt={"6"} justifyContent={"center"}>
          <PrimaryButton
            isLoading={isDepositing}
            loadingText={loadingText || preSwapLoadingText}
            size="large"
            onClick={supply}
          >
            Deposit
          </PrimaryButton>
        </Flex>
      </Box>
    </Flex>
  );
};

export default DepositModal;
