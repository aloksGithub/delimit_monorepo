import { AddIcon, DeleteIcon, ArrowForwardIcon } from "@chakra-ui/icons";
import { useAppContext } from "../components/Provider";
import {
  NumberInput,
  NumberInputField,
  Text,
  Flex,
  Box,
  Tooltip,
  useDisclosure,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInputStepper,
  Skeleton,
  Input,
  Grid,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  IconButton,
  useColorModeValue,
  Image,
  GridItem,
} from "@chakra-ui/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { ethers } from "ethers";
import erc20Abi from "../constants/abis/ERC20.json";
import poolAbi from "../constants/abis/IUniswapV3Pool.json";
import { SupplyAssets, SelectAsset } from "../components/selectAssets";
import { TickMath, encodeSqrtRatioX96 } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import Fraction from "fraction.js";
import { nFormatter } from "../utils";
import { swap } from "../contractCalls/transactions";
import { BiErrorAlt } from "react-icons/bi";
import { FancyButton, PrimaryButton } from "../components/Buttons";
import { getBlockExplorerUrlTransaction } from "../utils";
import { level0, level1, level2 } from "../components/Theme";
import { defaultUserAssetSupplied, defaultWantedAsset, UserAssetSupplied, WantedAsset } from "../Types";
import useUniversalSwapGetAmounts from "../hooks/useUniversalSwapGetAmounts";
import { getPriceUniversalSwap } from "../contractCalls/dataFetching";

// @ts-ignore
const TickPicker = forwardRef(({ pool, usdSupplied }, _ref) => {
  const {
    chainId,
    slippageControl: { slippage },
  } = useAppContext();
  const { provider } = useWeb3React();
  const [token0, setToken0] = useState();
  const [token1, setToken1] = useState();
  const [loading, setLoading] = useState(true);
  const [token0Name, setToken0Name] = useState("");
  const [token1Name, setToken1Name] = useState("");
  const [decimals0, setDecimals0] = useState(18);
  const [decimals1, setDecimals1] = useState(18);
  const [token0Main, setToken0Main] = useState(false);
  const [priceLower, setPriceLower] = useState(undefined);
  const [priceUpper, setPriceUpper] = useState(undefined);
  const [tickLower, setTickLower] = useState<number>();
  const [tickUpper, setTickUpper] = useState<number>();
  const [currentSqrtRatio, setCurrentSqrtRatio] = useState(undefined);
  const [currentPrice, setCurrentPrice] = useState(undefined);
  const [ratio, setRatio] = useState([undefined, undefined]);
  const [minAmount0, setMinAmount0] = useState(undefined);
  const [minAmount1, setMinAmount1] = useState(undefined);
  const [tickSpacing, seTickSpacing] = useState(10);

  useImperativeHandle(_ref, () => ({
    getUniV3Data: () => {
      return {
        minAmount0,
        minAmount1,
        tickLower,
        tickUpper,
        token0,
        token1,
        decimals0,
        decimals1,
      };
    },
  }));

  const getNearestUsableTick = (currentTick: number) => {
    if (currentTick == 0) {
      return 0;
    }
    const direction = currentTick >= 0 ? 1 : -1;
    currentTick *= direction;
    let nearestTick =
      currentTick % tickSpacing <= tickSpacing / 2
        ? currentTick - (currentTick % tickSpacing)
        : currentTick + (tickSpacing - (currentTick % tickSpacing));
    nearestTick *= direction;
    return nearestTick;
  };

  const amount0ForLiquidity = (sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI) => {
    return JSBI.divide(
      JSBI.divide(
        JSBI.multiply(JSBI.multiply(liquidity, JSBI.BigInt(2 ** 96)), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)),
        sqrtRatioBX96
      ),
      sqrtRatioAX96
    );
  };

  const amount1ForLiquidity = (sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI) => {
    return JSBI.divide(
      JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)),
      JSBI.BigInt("79228162514264337593543950336")
    );
  };

  const getAmountsForLiquidity = (sqrtRatioX96: JSBI, sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI) => {
    let ratio0: JSBI = JSBI.BigInt("0");
    let ratio1: JSBI = JSBI.BigInt("0");
    if (JSBI.lessThanOrEqual(sqrtRatioX96, sqrtRatioAX96)) {
      ratio0 = amount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
      ratio0 = JSBI.divide(ratio0, JSBI.BigInt(10 ** decimals0!));
    } else if (JSBI.lessThan(sqrtRatioX96, sqrtRatioBX96)) {
      ratio0 = amount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
      ratio0 = JSBI.divide(ratio0, JSBI.BigInt(10 ** decimals0!));
      ratio1 = amount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
      ratio1 = JSBI.divide(ratio1, JSBI.BigInt(10 ** decimals1!));
    } else {
      ratio1 = amount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
      ratio1 = JSBI.divide(ratio1, JSBI.BigInt(10 ** decimals1!));
    }
    return { ratio0: +ratio0?.toString(), ratio1: +ratio1?.toString() };
  };

  useEffect(() => {
    const calculateMinAmounts = async () => {
      // const {data:{price:price0}} = await (await fetch(`/api/tokenPrice?chainId=${chainId}&address=${token0}`)).json()
      // const {data:{price:price1}} = await (await fetch(`/api/tokenPrice?chainId=${chainId}&address=${token1}`)).json()
      // const amount0Usd = usdSupplied*ratio[0]/(ratio[0]+ratio[1])
      // const amount1Usd = usdSupplied*ratio[1]/(ratio[0]+ratio[1])
      // const amount0 = amount0Usd/price0
      // const amount1 = amount1Usd/price1
      // setMinAmount0((10**decimals0!*amount0*(100-slippage)/100).toFixed(0))
      // setMinAmount1((10**decimals1!*amount1*(100-slippage)/100).toFixed(0))
      // setLoading(false)
    };
    calculateMinAmounts();
  }, [ratio, token0, token1]);

  const calculateSqrtRatio = (price) => {
    let ratio;
    if (token0Main) {
      ratio = (1 / price) * 10 ** (decimals0 - decimals1);
    } else {
      ratio = price * 10 ** (decimals0 - decimals1);
    }
    let frac = new Fraction(ratio);
    let amount0 = frac.n;
    let amount1 = frac.d;
    if (frac.n === 0) {
      ratio = ratio * 10 ** 18;
      frac = new Fraction(ratio);
      amount0 = frac.n;
      amount1 = frac.d * 10 ** 18;
    }
    const sqrtPriceX96 = encodeSqrtRatioX96(amount1, amount0);
    return sqrtPriceX96;
  };

  useEffect(() => {
    if (priceLower && priceLower > 0 && priceUpper && priceUpper > 0) {
      const sqrtPriceAX96 = calculateSqrtRatio(priceLower);
      const sqrtPriceBX96 = calculateSqrtRatio(priceUpper);
      if (sqrtPriceAX96 && sqrtPriceBX96) {
        const tickLower = TickMath.getTickAtSqrtRatio(sqrtPriceAX96);
        setTickLower(getNearestUsableTick(tickLower));
        const tickUpper = TickMath.getTickAtSqrtRatio(sqrtPriceBX96);
        setTickUpper(getNearestUsableTick(tickUpper));
        const { ratio0, ratio1 } = getAmountsForLiquidity(
          currentSqrtRatio,
          sqrtPriceAX96,
          sqrtPriceBX96,
          JSBI.BigInt("1000000000000000000")
        );
        setRatio([ratio0, ratio1 ? ratio1 / currentPrice : 0]);
      }
    }
  }, [priceLower, priceUpper]);

  useEffect(() => {
    const fetchData = async () => {
      const poolContract = new ethers.Contract(pool, poolAbi, provider);
      const tickSpacing = await poolContract.tickSpacing();
      seTickSpacing(tickSpacing);
      const token0 = await poolContract.token0();
      const token1 = await poolContract.token1();
      setToken0(token0);
      setToken1(token1);
      const token0Contract = new ethers.Contract(token0, erc20Abi, provider);
      const token1Contract = new ethers.Contract(token1, erc20Abi, provider);
      const decimals0 = await token0Contract.decimals();
      const decimals1 = await token1Contract.decimals();
      setDecimals0(decimals0);
      setDecimals1(decimals1);
      const token0Name = await token0Contract.symbol();
      const token1Name = await token1Contract.symbol();
      const { sqrtPriceX96, tick } = await poolContract.slot0();
      const token1Price = 2 ** 192 / sqrtPriceX96 ** 2 / 10 ** (decimals0 - decimals1);
      const token0Price = sqrtPriceX96 ** 2 / 2 ** 192 / 10 ** (decimals1 - decimals0);
      const token0Main = token0Price > token1Price;
      setCurrentSqrtRatio(JSBI.BigInt(sqrtPriceX96));
      setCurrentPrice(token1Price);
      setToken0Main(token0Main);
      setToken0Name(token0Name);
      setToken1Name(token1Name);
      setPriceLower(token0Main ? (token0Price - 0.001).toFixed(3) : (token1Price - 0.001).toFixed(3));
      setPriceUpper(token0Main ? (token0Price + 0.001).toFixed(3) : (token1Price + 0.001).toFixed(3));
    };
    try {
      setLoading(true);
      fetchData();
    } catch {
      console.log("ERROR");
    }
  }, [pool]);

  return (
    <>
      {loading ? (
        <Flex mt={"4"} justifyContent={"space-around"}>
          <Skeleton width={"150px"} height="40px" />
          <Skeleton width={"150px"} height="40px" />
        </Flex>
      ) : (
        <Flex mt={"4"} justifyContent={"space-around"}>
          <Box>
            <Text>
              Min {token0Main ? token0Name : token1Name} per {token0Main ? token1Name : token0Name}
            </Text>
            <NumberInput
              min={0}
              max={priceUpper}
              maxW={"150px"}
              value={priceLower}
              precision={3}
              step={0.001}
              onChange={(valueAsNumber) => setPriceLower(valueAsNumber)}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </Box>
          <Box>
            <Text>
              Max {token0Main ? token0Name : token1Name} per {token0Main ? token1Name : token0Name}
            </Text>
            <NumberInput
              min={priceLower}
              maxW={"150px"}
              value={priceUpper}
              precision={3}
              step={0.001}
              onChange={(valueAsNumber) => setPriceUpper(valueAsNumber)}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </Box>
        </Flex>
      )}
    </>
  );
});

interface SelectWantedAssetProps {
  usdSupplied: number;
  selected: WantedAsset;
  setSelected: (asset: WantedAsset) => void;
  updateExpected: (expected: number, price: number) => void;
  changePercentage: (percentage: number) => void;
  deleteSelf: () => void;
}

const SelectWantedAsset = ({
  usdSupplied,
  selected,
  setSelected,
  updateExpected,
  changePercentage,
  deleteSelf,
}: SelectWantedAssetProps) => {
  const { supportedAssets, contracts, counter } = useAppContext();
  const {
    slippageControl: { slippage },
  } = useAppContext();
  const [loadingSelf, setLoadingSelf] = useState(false);

  useEffect(() => {
    if (counter % 10 === 0) {
      reload();
    }
  }, [counter]);

  useEffect(() => {
    reload();
  }, [selected]);

  const minOut = ((selected.expected || 0) * (100 - slippage)) / 100;
  const minUsd = minOut * selected.price;

  const reload = async () => {
    if (selected.contract_address) {
      const { price } = await getPriceUniversalSwap(contracts, selected.contract_address);
      const expected = (usdSupplied * selected.percentage) / 100 / price;
      updateExpected(expected, price);
    } else {
      updateExpected(0, 0);
    }
    setLoadingSelf(false);
  };

  useEffect(() => {
    setLoadingSelf(true);
    reload();
  }, [selected.contract_address]);

  useEffect(() => {
    if (selected.price > 0) {
      const expected = (usdSupplied * selected.percentage) / 100 / selected.price;
      updateExpected(expected, selected.price);
    } else {
      updateExpected(0, selected.price);
    }
  }, [selected.percentage, usdSupplied]);

  return (
    <Flex
      width={"100%"}
      mt="4"
      padding={"4"}
      justifyContent={"space-between"}
      alignItems={"center"}
      borderRadius={"2xl"}
      backgroundColor={useColorModeValue(...level1)}
    >
      <Box>
        <SelectAsset assets={supportedAssets} asset={selected} onSelect={setSelected}></SelectAsset>
        <Flex alignItems={"center"} mt={"3"}>
          <Text
            onClick={deleteSelf}
            mr={"3"}
            textAlign={"center"}
            borderRadius={"lg"}
            width={"2rem"}
            padding={"1"}
            _hover={{ cursor: "pointer", backgroundColor: "red.400" }}
            backgroundColor="red.300"
          >
            <DeleteIcon />
          </Text>
          <NumberInput
            maxWidth={"100"}
            min={0}
            max={100}
            value={selected.percentage + "%"}
            onChange={(valueAsString) => changePercentage(+valueAsString.replace(/^\%/, ""))}
          >
            <NumberInputField backgroundColor={useColorModeValue(...level0)}></NumberInputField>
          </NumberInput>
        </Flex>
      </Box>
      <Flex flexDirection={"column"} alignItems={"end"} textAlign={"end"}>
        <Flex>Price: ${!loadingSelf ? <Text>{nFormatter(selected.price, 3)}</Text> : <Skeleton>Temp</Skeleton>}</Flex>
        {!loadingSelf ? (
          <Input
            my={"2"}
            isReadOnly
            height={"48px"}
            textAlign={"end"}
            variant="unstyled"
            fontSize={"2xl"}
            size={"lg"}
            maxWidth="150px"
            value={selected.expected}
          ></Input>
        ) : (
          <Skeleton>Temporary Temporary</Skeleton>
        )}
        {!loadingSelf ? (
          <Text>
            Min: ~{minOut.toFixed(3)} (${minUsd.toFixed(3)})
          </Text>
        ) : (
          <Skeleton>Temporary</Skeleton>
        )}
      </Flex>
    </Flex>
  );
};

const ConvertTo = ({
  usdSupplied,
  wantedAssets,
  updateWantedAssets,
}: {
  usdSupplied: number;
  wantedAssets: WantedAsset[];
  updateWantedAssets: (assets: WantedAsset[]) => void;
}) => {
  const {
    slippageControl: { slippage },
  } = useAppContext();

  useEffect(() => {
    const temp = [...wantedAssets];
    // @ts-ignore
    for (const [index, asset] of temp.entries()) {
      temp[index].minOut = (temp[index].expected * (100 - slippage)) / 100;
    }
    updateWantedAssets(temp);
  }, [slippage]);

  const addWanted = () => {
    updateWantedAssets([...wantedAssets, JSON.parse(JSON.stringify(defaultWantedAsset))]);
  };

  const select = (index, asset) => {
    const temp = [...wantedAssets];
    temp[index] = { ...temp[index], ...asset };
    updateWantedAssets(temp);
  };

  const setExpected = (index, expected, price) => {
    const temp = [...wantedAssets];
    temp[index].expected = expected;
    temp[index].minOut = (expected * (100 - slippage)) / 100;
    temp[index].price = price;
  };

  const removeWanted = (index) => {
    if (wantedAssets.length === 1) return;
    const tempAssets = [...wantedAssets];
    tempAssets.splice(index, 1);
    updateWantedAssets(tempAssets);
  };

  const updatePercentages = (index: number, percentage: number) => {
    const temp = [...wantedAssets];
    temp[index].percentage = percentage;
    if (temp.length===2) {
      if (index===0) {
        temp[1].percentage = 100-percentage
      } else {
        temp[0].percentage = 100-percentage
      }
    }
    updateWantedAssets(temp);
  };

  return (
    <Box
      padding={"5"}
      width={"100%"}
      maxWidth="450px"
      alignItems={"center"}
      bg="hidden"
      borderRadius={"2xl"}
      border="1px"
      borderColor={useColorModeValue(...level2)}
    >
      <Flex width={"100%"} justifyContent="space-between" alignItems={"center"}>
        <IconButton
          color="white"
          bgColor={useColorModeValue("blue.500", "blue.600")}
          _hover={{ bgColor: useColorModeValue("blue.600", "blue.700") }}
          _focus={{ bgColor: useColorModeValue("blue.700", "blue.800") }}
          aria-label="Add Asset"
          onClick={addWanted}
          icon={<AddIcon />}
        />
        <Text textAlign={"end"}>Slippage: {slippage}%</Text>
      </Flex>
      {wantedAssets.map((asset, index) => (
        <SelectWantedAsset
          key={`wantedAsset_${index}`}
          usdSupplied={usdSupplied}
          selected={asset}
          setSelected={(asset) => select(index, asset)}
          changePercentage={(percentage) => updatePercentages(index, percentage)}
          updateExpected={(expected, price) => setExpected(index, expected, price)}
          deleteSelf={() => removeWanted(index)}
        />
      ))}
    </Box>
  );
};

const UniversalSwap = () => {
  const [assetsToConvert, setAssetsToConvert] = useState<UserAssetSupplied[]>([defaultUserAssetSupplied]);
  const [wantedAssets, setWantedAssets] = useState<WantedAsset[]>([JSON.parse(JSON.stringify({...defaultWantedAsset, percentage: 100}))]);
  const updateWantedAssets = (assets: WantedAsset[]) => {
    setWantedAssets(assets);
  };
  const [usdSupplied, setUsdSupplied] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isPreviewOpen, onOpen: onOpenPreview, onClose: onClosePreview } = useDisclosure();
  const { isOpen: isFinalOpen, onOpen: onOpenFinal, onClose: onCloseFinal } = useDisclosure();
  const [error, setError] = useState("");
  const { contracts, onError, hardRefreshAssets, chainId, counter } = useAppContext();
  const { provider, account } = useWeb3React();
  const signer = provider?.getSigner(account);
  const [previewing, setPreviewing] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const triggerError = (error: string) => {
    setError(error);
    onOpen();
    setPreviewing(false);
    setSwapping(false);
  };
  const {
    data: swapData,
    loading: previewLoading,
    loadingText: previewLoadingText,
  } = useUniversalSwapGetAmounts({ assetsToConvert, wantedAssets, parentLoading: previewing, triggerError });
  const [deadline, setDeadline] = useState(0);
  const [obtainedAssets, setObtainedAssets] = useState<WantedAsset[]>();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const usdSupplied = assetsToConvert.reduce((a, b) => a + (b.usdcValue || 0), 0);
    setUsdSupplied(usdSupplied);
  }, [assetsToConvert]);

  useEffect(() => {
    if (previewing && !previewLoading && swapData.expectedAssets) {
      setDeadline(counter + 31);
      onOpenPreview();
      setPreviewing(false);
    }
  }, [swapData.expectedAssets]);

  const preview = async () => {
    setPreviewing(true);
  };

  const proceed = () => {
    setSwapping(true);
    if (!contracts.universalSwap) {
      triggerError("Looks like Delimit contracts have not yet been deployed on this chain, please switch to BSC");
      setSwapping(false);
      return;
    }

    swap(
      contracts,
      signer,
      swapData.provided,
      swapData.desired,
      swapData.swaps,
      swapData.conversions,
      swapData.expectedAssets
    ).then(
      (data) => {
        const { expectedAssets, hash } = data;
        setHash(hash);
        setSwapping(false);
        setObtainedAssets(expectedAssets);
        onClosePreview();
        setAssetsToConvert([defaultUserAssetSupplied]);
        setWantedAssets([defaultWantedAsset]);
        onOpenFinal();
        hardRefreshAssets();
      },
      (reason) => {
        onError(reason);
        setSwapping(false);
      }
    );
  };
  return (
    <Flex alignItems={"center"} direction={"column"} marginTop={"10vh"}>
      <Grid width={"100%"} templateColumns={{ base: "1fr", lg: "6fr 1fr 6fr" }}>
        <GridItem>
          <Flex justifyContent={{ lg: "end", base: "center" }}>
            <SupplyAssets assetsToConvert={assetsToConvert} setAssetsToConvert={setAssetsToConvert} />
          </Flex>
        </GridItem>
        <GridItem>
          <Flex marginBlock={{ lg: "24", base: "5" }} justifyContent={"center"}>
            <ArrowForwardIcon transform={{ base: "rotate(90deg)", lg: "rotate(0deg)" }} fontSize={"2rem"} />
          </Flex>
        </GridItem>
        <GridItem>
          <Flex justifyContent={{ lg: "start", base: "center" }}>
            <ConvertTo
              usdSupplied={usdSupplied}
              wantedAssets={wantedAssets}
              updateWantedAssets={updateWantedAssets}
            ></ConvertTo>
          </Flex>
        </GridItem>
      </Grid>
      <FancyButton
        loadingText={previewLoadingText}
        isLoading={previewing}
        mt="20"
        height="85px"
        width="70%"
        onClick={preview}
      >
        <Text fontSize={"3xl"} color={"white"}>
          Preview
        </Text>
      </FancyButton>
      <Modal size={"sm"} isCentered isOpen={isPreviewOpen} onClose={onClosePreview}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent bgColor={useColorModeValue(...level1)}>
          <ModalHeader>
            <Flex alignItems={"center"}>
              <Text fontSize={"2xl"} ml={"4"}>
                Preview
              </Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box mb={"6"}>
              <Text textAlign={"end"}>
                <Text as="b">Total:</Text> $
                {nFormatter(
                  swapData?.expectedAssets?.reduce((a, b) => a + +b.quote, 0),
                  3
                )}
              </Text>
              {swapData?.expectedAssets?.map((asset) => {
                return (
                  <Flex
                    backgroundColor={useColorModeValue(...level2)}
                    alignItems={"center"}
                    justifyContent={"space-between"}
                    marginBlock={"4"}
                    padding="4"
                    borderRadius={"2xl"}
                  >
                    <Flex width={"40%"} alignItems={"center"}>
                      <Image
                        src={asset.logo_url.toLowerCase()}
                        fallbackSrc="https://www.svgrepo.com/show/99387/dollar.svg"
                        style={{ width: "20px", height: "20px", borderRadius: "15px" }}
                      />
                      <Text fontSize={"l"} pl={"2"}>
                        {asset.contract_name}
                      </Text>
                    </Flex>
                    <Box width={"60%"} textAlign={"end"}>
                      <Tooltip hasArrow label={asset.minOut > asset.expected ? "Increase slippage" : ""}>
                        <Text
                          textColor={
                            asset.minOut > asset.expected
                              ? useColorModeValue("red", "red.400")
                              : useColorModeValue("black", "white")
                          }
                        >
                          <Text as="b">Expected: </Text>
                          {nFormatter(asset.expected, 5)}
                        </Text>
                      </Tooltip>
                      <Text>
                        <Text as="b">USD: </Text> ${nFormatter(asset.quote, 2)}
                      </Text>
                    </Box>
                  </Flex>
                );
              })}
              <Flex justifyContent={"center"}>
                <FancyButton
                  isLoading={swapping || previewing}
                  mt="4"
                  height="85px"
                  width="100%"
                  onClick={deadline > counter ? proceed : preview}
                >
                  <Text fontSize={"2xl"} color={"white"}>
                    {deadline > counter ? "Swap" : "Refresh"}&nbsp; ({deadline > counter ? deadline - counter : 0}s)
                  </Text>
                </FancyButton>
              </Flex>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
      <Modal size={"sm"} isCentered isOpen={isFinalOpen} onClose={onCloseFinal}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent bgColor={useColorModeValue(...level1)}>
          <ModalHeader>
            <Flex alignItems={"center"}>
              <Text fontSize={"2xl"} textAlign={"center"}>
                Assets Obtained
              </Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>
              <Text paddingInline="4">
                Assets worth $
                {nFormatter(
                  obtainedAssets?.reduce((a, b) => a + +b.quote, 0),
                  3
                )}{" "}
                were obtained from the transaction. View{" "}
                <a href={getBlockExplorerUrlTransaction(chainId, hash)} target="_blank" rel="noopener noreferrer">
                  <Text color={"blue.500"} as="u">
                    Transaction
                  </Text>
                </a>{" "}
                on block explorer
              </Text>
              {obtainedAssets?.map((asset) => {
                return (
                  <Flex
                    backgroundColor={useColorModeValue(...level2)}
                    alignItems={"center"}
                    justifyContent={"space-between"}
                    marginBlock={"4"}
                    padding="4"
                    borderRadius={"2xl"}
                  >
                    <Flex width={"40%"} alignItems={"center"}>
                      <img src={asset.logo_url.toLowerCase()} style={{ width: "20px", height: "20px", borderRadius: "15px" }} />
                      <Text pl={"2"}>{asset.contract_name}</Text>
                    </Flex>
                    <Box width={"60%"} textAlign={"end"}>
                      <Text>
                        <Text as="b">Amount: </Text>
                        {nFormatter(asset.expected, 5)}
                      </Text>
                      <Text>
                        <Text as="b">USD: </Text> ${nFormatter(asset.quote, 2)}
                      </Text>
                    </Box>
                  </Flex>
                );
              })}
              <Flex marginBlock={"6"} justifyContent={"space-around"}>
                <PrimaryButton onClick={onCloseFinal}>
                  <Text paddingInline={"6"}>Finish</Text>
                </PrimaryButton>
              </Flex>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
      <Modal size={"sm"} isCentered isOpen={isOpen} onClose={onClose}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent>
          <ModalHeader>
            <Flex alignItems={"center"}>
              {<BiErrorAlt color="red" fontSize={"2rem"} />}
              <Text ml={"4"}>Error</Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody mb="4">
            <Text>{error}</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default UniversalSwap;
