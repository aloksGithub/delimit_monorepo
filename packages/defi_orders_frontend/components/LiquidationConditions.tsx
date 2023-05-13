import { AddIcon, DeleteIcon, InfoIcon } from "@chakra-ui/icons";
import {
  Text,
  Flex,
  NumberInput,
  NumberInputField,
  Button,
  Box,
  IconButton,
  Skeleton,
  useColorModeValue,
  Grid,
  GridItem,
  Tooltip,
} from "@chakra-ui/react";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { useAppContext } from "./Provider";
import { SelectAsset } from "./selectAssets";
import { Reload } from "./Reload";
import { level2 } from "./Theme";
import { Asset } from "../Types";
import { getPriceUniversalSwap } from "../contractCalls/dataFetching";

const Condition = ({
  i,
  condition,
  setWatchedAsset,
  setConvertTo,
  removeAsset,
  setLiquidationPoint,
  setSlippage,
  loading,
}) => {
  const { supportedAssets, contracts, chainId } = useAppContext();

  const parseSlippage = (val) => val.replace(/^\%/, "");
  const formatSlippage = (val) => val + `%`;
  const self: Asset = {
    contract_name: "Value of self",
    contract_ticker_symbol: "Self",
    contract_address: contracts.positionManager.address,
    contract_decimals: 18,
    protocol_name: 'Delimit',
    chain_id: chainId,
    underlying: [],
    logo_url: "https://www.svgrepo.com/show/99387/dollar.svg",
  };

  const onSelectConvertTo = (asset) => {
    setConvertTo(asset);
  };

  return (
    <Grid
      zIndex={2}
      marginBlock={"2"}
      padding={"4"}
      gap="4"
      borderRadius={"2xl"}
      backgroundColor={useColorModeValue(...level2)}
      overflowX={"auto"}
      width={"100%"}
      gridTemplateColumns="1.5fr 2fr 2fr 0.5fr"
    >
      <GridItem marginBlock={"auto"}>
        <Flex mb={"4"}>
          {/* @ts-ignore */}
          <SelectAsset
            asset={condition.watchedAsset}
            onSelect={setWatchedAsset}
            assets={[self, ...(supportedAssets || [])]}
            placeHolder={"Watched price"}
            higher={true}
          />
        </Flex>
        <Flex alignItems={"center"}>
          {/* @ts-ignore */}
          <SelectAsset
            asset={condition.convertTo}
            onSelect={onSelectConvertTo}
            assets={supportedAssets}
            placeHolder={"liquidate To"}
            higher={true}
          />
        </Flex>
      </GridItem>
      <GridItem display={"flex"} flexDirection="column">
        <Text zIndex={1} mb={"2"} as="b">
          Slippage&nbsp;&nbsp;
          <Tooltip label='Liquidation fee is not included in slippage calculation' maxWidth={'150px'}>
            <InfoIcon></InfoIcon>
          </Tooltip>
        </Text>
        <NumberInput
          minWidth={"100"}
          width={"90%"}
          min={0.001}
          max={100}
          onChange={(valueString) => setSlippage(parseSlippage(valueString))}
          value={formatSlippage(condition.slippage)}
        >
          <NumberInputField
            paddingInline="4"
            backgroundColor={useColorModeValue("white", "gray.800")}
          ></NumberInputField>
        </NumberInput>
      </GridItem>
      <GridItem display={"flex"} justifyContent={"center"} flexDirection={"column"} mr={"4"}>
        <Text mb={"2"} as="b">
          Price limit
        </Text>
        <NumberInput
          mb={"2"}
          value={condition.liquidationPoint || "0"}
          width={"90%"}
          minWidth={"100"}
          onChange={(valueAsNumber) => setLiquidationPoint(valueAsNumber)}
        >
          <NumberInputField
            paddingInline="4"
            backgroundColor={useColorModeValue("white", "gray.800")}
          ></NumberInputField>
        </NumberInput>
        <Flex>
          <Text>Price:&nbsp;</Text>
          {!loading ? (
            <Text>${(+condition.price || 0).toFixed(3)}</Text>
          ) : (
            <Skeleton>
              <Text>TEMP</Text>
            </Skeleton>
          )}
        </Flex>
      </GridItem>
      <GridItem
        display={"flex"}
        alignItems={"center"}
        paddingBlock={"8"}
        pl={"3"}
        borderLeft={"1px"}
        borderColor={useColorModeValue("white", "gray.800")}
      >
        <Text
          zIndex={1}
          textAlign={"center"}
          borderRadius={"lg"}
          width={"2rem"}
          padding={"1"}
          onClick={() => removeAsset(i)}
          _hover={{ cursor: "pointer", backgroundColor: "red.400" }}
          backgroundColor="red.300"
        >
          <DeleteIcon />
        </Text>
      </GridItem>
    </Grid>
  );
};

// @ts-ignore
const LiquidationConditions = ({
  assetPrice,
  initialLiquidationPoints = undefined,
  liquidationPoints,
  onChangeConditions,
  resetFlag,
  onReload,
  loading,
  errorMessage=undefined
}) => {
  const {
    chainId,
    slippageControl: { slippage },
    contracts,
  } = useAppContext();

  const [initialized, setInitialized] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(Array(liquidationPoints?.length || 0).fill(false));
  const failedOrder: number|undefined = +errorMessage?.split("_")[0]

  useEffect(() => {
    if (initialLiquidationPoints && initialLiquidationPoints.length > 0 && !initialized) {
      setInitialized(true);
      onChangeConditions(JSON.parse(JSON.stringify(initialLiquidationPoints)));
    }
  }, [initialLiquidationPoints]);

  useEffect(() => {
    if (initialLiquidationPoints) {
      onChangeConditions(JSON.parse(JSON.stringify(initialLiquidationPoints)));
    }
  }, [resetFlag]);

  useEffect(() => {
    if (liquidationPoints) {
      const temp = [...liquidationPoints];
      for (const condition of temp) {
        if (condition.watchedAsset?.contract_address === contracts.positionManager.address) {
          condition.price = assetPrice;
          condition.lessThan = +condition.liquidationPoint < +assetPrice;
        }
      }
      onChangeConditions(temp);
    }
  }, [assetPrice]);

  const reload = async () => {
    onReload();
    if (liquidationPoints) {
      // @ts-ignore
      for (const [index, condition] of liquidationPoints.entries()) {
        setWatchedAsset(index, condition.watchedAsset);
      }
    }
  };

  const addCondition = () => {
    const temp = [...liquidationPoints];
    temp.push({
      watchedAsset: undefined,
      liquidationPoint: 0,
      lessThan: false,
      convertTo: undefined,
      price: 0,
      slippage: slippage,
    });
    setLoadingPrices(loadingPrices.concat([false]));
    onChangeConditions(temp);
  };

  const removeCondition = (index: number) => {
    if (liquidationPoints.length === 1) return;
    const temp = [...liquidationPoints];
    temp.splice(index, 1);
    loadingPrices.splice(index, 1);
    setLoadingPrices(loadingPrices);
    onChangeConditions(temp);
  };

  const setConvertTo = (index, asset) => {
    const temp = [...liquidationPoints];
    temp[index].convertTo = asset;
    onChangeConditions(temp);
  };

  const setWatchedAsset = (index, asset) => {
    const temp = [...liquidationPoints];
    temp[index].watchedAsset = asset;
    const setPrice = async () => {
      if (asset?.contract_address === contracts.positionManager.address) {
        temp[index].price = assetPrice;
      } else {
        if (asset?.contract_address) {
          const { price } = await getPriceUniversalSwap(contracts, asset.contract_address);
          temp[index].price = price;
        }
      }
      if (+temp[index].liquidationPoint < +temp[index].price) {
        temp[index].lessThan = true;
      } else {
        temp[index].lessThan = false;
      }
      onChangeConditions(temp);
      loadingPrices[index] = false;
      setLoadingPrices(loadingPrices);
    };
    setPrice();
    loadingPrices[index] = asset?.contract_address === contracts.positionManager.address ? false : true;
    setLoadingPrices(loadingPrices);
  };

  const setLiquidationPoint = (index, point: number) => {
    const temp = [...liquidationPoints];
    temp[index].liquidationPoint = point;
    if (+point < +temp[index].price) {
      temp[index].lessThan = true;
    } else {
      temp[index].lessThan = false;
    }
    onChangeConditions(temp);
  };

  const setSlippage = (index, slippage: number) => {
    const temp = [...liquidationPoints];
    temp[index].slippage = slippage;
    onChangeConditions(temp);
  };

  return (
    <Box marginTop={"5"} width={"100%"}>
      <Box margin={"auto"}>
        <Flex justifyContent={"end"}>
          <Reload onReload={reload} loading={loading} />
          <IconButton
            ml={"2"}
            color="white"
            bgColor={useColorModeValue("blue.500", "blue.600")}
            _hover={{ bgColor: useColorModeValue("blue.600", "blue.700") }}
            _focus={{ bgColor: useColorModeValue("blue.700", "blue.800") }}
            aria-label="Add condition"
            onClick={addCondition}
            icon={<AddIcon />}
          />
        </Flex>
        {liquidationPoints && liquidationPoints.length > 0 ? (
          liquidationPoints.map((condition, index) => {
            return (
              <Box position={'relative'}>
                {
                  index===failedOrder?
                  <Tooltip label={`Order failed with error: ${errorMessage?.split("_")[1]}`}>
                    <Box
                      zIndex={0}
                      borderRadius={"2xl"}
                      position='absolute'
                      height='100%' width={'100%'}
                      bgColor={'red.200'} opacity='0.3'>
                    </Box>
                  </Tooltip>:<></>
                }
              <Condition
                i={index}
                condition={condition}
                setConvertTo={(asset) => setConvertTo(index, asset)}
                setWatchedAsset={(asset) => setWatchedAsset(index, asset)}
                removeAsset={() => removeCondition(index)}
                setLiquidationPoint={(point) => setLiquidationPoint(index, point)}
                setSlippage={(slippage) => setSlippage(index, slippage)}
                loading={loading || loadingPrices[index]}
              />
              </Box>
            );
          })
        ) : (
          <Skeleton minWidth={"500px"} height="140" marginBlock={"2"} padding={"4"} borderRadius={"2xl"}></Skeleton>
        )}
      </Box>
    </Box>
  );
};

export default LiquidationConditions;
