import { useWeb3React } from "@web3-react/core";
import { useAppContext } from "../components/Provider";
import { Box, Flex, Text, Button, Heading, Stack, useColorModeValue, Skeleton, VStack, Image, Tooltip } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pagination } from "../components/Pagination";
import { VscGraphLine } from "react-icons/vsc";
import { IoMdSettings } from "react-icons/io";
import { BigNumber } from "ethers";
import { getBlockExplorerUrl, getBlockExplorerUrlTransaction, nFormatter } from "../utils";
import { AiOutlineShrink } from "react-icons/ai";
import { harvest, compound } from "../contractCalls/transactions";
import { PrimaryButton } from "../components/Buttons";
import { level1, level2 } from "../components/Theme";
import usePosition from "../hooks/usePosition";
import { WarningTwoIcon } from "@chakra-ui/icons";

const Card = ({ id }: { id: number }) => {
  const {
    contracts,
    chainId,
    onError,
    slippageControl: { slippage },
    successModal,
  } = useAppContext();
  const [refresh, setRefresh] = useState(false);
  const {
    data: { positionInfo, asset, underlying, rewards, usdcValue },
    loading,
  } = usePosition(id, refresh);
  const [expandRewards, setExpandRewards] = useState(false);
  const [isHarvesting, setHarvesting] = useState(false);
  const [isCompounding, setCompounding] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string>(undefined)

  useEffect(() => {
    contracts.positionManager.liquidationFailure(id).then(message=>{
      if (message!="") {
        const orderNumber = +message.split("_")[0]
        const revertReason = message.split("_")[1]
        setFailureMessage(`Limit order #${orderNumber+1} failed with error: ${revertReason}`)
      } else {
        setFailureMessage(undefined)
      }
    })
  }, [id])

  const harvestPosition = () => {
    setHarvesting(true);
    harvest(contracts, id)
      .then((hash) => {
        setHarvesting(false);
        setRefresh(!refresh);
        successModal(
          "Harvest Successful",
          <Text>
            Rewards were successfully harvested, View{" "}
            <a href={getBlockExplorerUrlTransaction(chainId, hash)} target="_blank" rel="noopener noreferrer">
              <Text as="u" textColor={"blue.500"}>
                transaction
              </Text>
            </a>
            &nbsp;on block explorer.
          </Text>
        );
      })
      .catch((error) => {
        setHarvesting(false);
        onError(error);
      });
  };

  const compoundPosition = () => {
    setCompounding(true);
    compound(contracts, id, positionInfo, slippage, chainId)
      .then((hash) => {
        setCompounding(false);
        setRefresh(!refresh);
        successModal(
          "Reinvest Successful",
          <Text>
            Rewards were successfully reinvested, View{" "}
            <a href={getBlockExplorerUrlTransaction(chainId, hash)} target="_blank" rel="noopener noreferrer">
              <Text as="u" textColor={"blue.500"}>
                transaction
              </Text>
            </a>
            &nbsp;on block explorer.
          </Text>
        );
      })
      .catch((error) => {
        onError(error);
        setCompounding(false);
      });
  };

  return (
    <Box position="relative" minW={"300px"}>
      {
        failureMessage?
        <Box
          zIndex={1}
          rounded={"lg"}
          position='absolute'
          height='100%' width={'100%'}
          bgColor={'red.200'} opacity='0.3'>
        </Box>:
        <></>
      }
      <Flex
        direction={"column"}
        justifyContent={"space-between"}
        h={"100%"}
        w={"full"}
        bg={useColorModeValue(...level1)}
        boxShadow={"2xl"}
        rounded={"lg"}
        p={6}
        textAlign={"center"}
      >
        {
          failureMessage?
          <Tooltip zIndex={3} label={failureMessage}>
            <WarningTwoIcon zIndex={3} fontSize={'1.3rem'} color={'red.400'} position={'absolute'} right={8}></WarningTwoIcon>
          </Tooltip>:
          <></>
        }
        <Flex zIndex={2} mb={"3"} pb={"3"} justifyContent={"center"} alignItems={"center"}>
          {!loading ? (
            <Flex>
              <Image
                src={asset?.logo_url.toLowerCase()}
                fallbackSrc="https://www.svgrepo.com/show/99387/dollar.svg"
                borderRadius={"full"}
                style={{ width: "30px", height: "30px" }}
              />
              <a href={getBlockExplorerUrl(chainId, asset?.contract_address)} target="_blank" rel="noopener noreferrer">
                <Heading _hover={{ color: "blue.500" }} ml={"3"} fontSize={"xl"}>
                  {asset?.contract_ticker_symbol}
                </Heading>
              </a>
            </Flex>
          ) : (
            <Skeleton>
              <Heading>Temp Title</Heading>
            </Skeleton>
          )}
        </Flex>
        <Flex zIndex={2}>
          <Box width={"100%"}>
            <Flex mb={"3"} flexDir={"column"} alignItems={"start"}>
              <Heading fontSize={"m"}>Underlying</Heading>
              <Box mt={"1"}>
                {!loading ? (
                  underlying?.map((token) => (
                    <Flex alignItems={"center"}>
                      <img src={token.logo_url.toLowerCase()} style={{ width: "20px", height: "20px", borderRadius: "15px" }} />
                      <a
                        href={getBlockExplorerUrl(chainId, token.contract_address)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Text
                          _hover={{ color: "blue.500", cursor: "pointer" }}
                          display={"flex"}
                          alignItems={"center"}
                          ml={"2"}
                          mr={"1"}
                        >
                          {token.contract_ticker_symbol}
                        </Text>
                      </a>
                    </Flex>
                  ))
                ) : (
                  <VStack gap={"1"} m="1">
                    <Skeleton>
                      <Text>Temp Token</Text>
                    </Skeleton>
                  </VStack>
                )}
              </Box>
            </Flex>
            <Flex mb={"3"} flexDir={"column"} alignItems={"start"}>
              <Heading fontSize={"m"}>USD Value</Heading>
              <Flex justifyContent={"center"}>
                $
                {!loading ? (
                  usdcValue
                ) : (
                  <Skeleton m="1">
                    <Text>Temp</Text>
                  </Skeleton>
                )}
              </Flex>
            </Flex>
          </Box>
          {rewards && rewards.length > 0 ? (
            <Box width={"100%"}>
              <Heading textAlign={"end"} fontSize={"m"}>
                Rewards
              </Heading>
              <Flex
                mt={"1"}
                flexDirection={"column"}
                alignItems={expandRewards ? "start" : "end"}
                ml={"6"}
                p={"3"}
                borderRadius={"lg"}
                backgroundColor={useColorModeValue(...level2)}
                _hover={{
                  cursor: !expandRewards ? "pointer" : "auto",
                  backgroundColor: useColorModeValue("gray.200", !expandRewards ? "gray.600" : "gray.700"),
                }}
                onClick={() => (!expandRewards ? setExpandRewards(!expandRewards) : {})}
                position={expandRewards ? "absolute" : "static"}
                right="24px"
                left="0px"
                boxShadow={expandRewards ? "xl" : "none"}
                sx={{ transition: "0.4s" }}
              >
                {rewards.map((reward) => (
                  <Flex>
                    <Image
                      src={reward.logo_url.toLowerCase()}
                      fallbackSrc="https://www.svgrepo.com/show/99387/dollar.svg"
                      style={{ width: "20px", height: "20px", borderRadius: "15px" }}
                    />
                    <a
                      href={getBlockExplorerUrl(chainId, reward.contract_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Text
                        _hover={{ color: "blue.500", cursor: "pointer" }}
                        display={"flex"}
                        alignItems={"center"}
                        ml={"2"}
                        mr={"1"}
                      >
                        {reward.contract_ticker_symbol}
                      </Text>
                    </a>
                    {expandRewards ? (
                      <Text>
                        : {nFormatter(reward.formattedBalance, 2)} (${nFormatter(reward.quote, 2)})
                      </Text>
                    ) : (
                      <></>
                    )}
                  </Flex>
                ))}
                {expandRewards ? (
                  <Flex margin={"auto"} mt={"6"}>
                    <Button
                      isLoading={isHarvesting}
                      colorScheme={"blue"}
                      mr={"3"}
                      size={"sm"}
                      onClick={harvestPosition}
                    >
                      Harvest
                    </Button>
                    <Button isLoading={isCompounding} colorScheme={"blue"} size={"sm"} onClick={compoundPosition}>
                      Reinvest
                    </Button>
                    <Box
                      _hover={{ cursor: "pointer" }}
                      onClick={() => setExpandRewards(false)}
                      position={"absolute"}
                      top="8px"
                      right="8px"
                    >
                      <Text _hover={{ color: "blue.300" }}>
                        <AiOutlineShrink fontSize={"1.3rem"}></AiOutlineShrink>
                      </Text>
                    </Box>
                  </Flex>
                ) : (
                  <></>
                )}
              </Flex>
            </Box>
          ) : (
            <></>
          )}
        </Flex>

        <Stack zIndex={2} mt={8} direction={"row"} spacing={4}>
          <Link href={`/editOrders/${id}`}>
            <PrimaryButton flex={1}>
              <IoMdSettings fontSize={"1.3rem"}></IoMdSettings>
              &nbsp;Edit
            </PrimaryButton>
          </Link>
          <Link href={`/analytics/${id}`}>
            <Button
              color="white"
              bgColor={useColorModeValue("green.500", "green.600")}
              _hover={{ bgColor: useColorModeValue("green.600", "green.700") }}
              _focus={{ bgColor: useColorModeValue("green.700", "green.800") }}
              rounded={"full"}
            >
              <VscGraphLine fontSize={"1.3rem"}></VscGraphLine>
              &nbsp;Analytics
            </Button>
          </Link>
        </Stack>
      </Flex>
    </Box>
  );
};

const Positions = () => {
  const { contracts } = useAppContext();
  const { account, provider } = useWeb3React();
  const [userPositions, setUserPositions] = useState<number[]>();
  const [active, setActive] = useState(true);
  const [needSelector, setNeedSelector] = useState(false);

  useEffect(() => {
    if (!contracts?.positionManager || !account) {
      setUserPositions([])
      return;
    }
    const getPositions = async () => {
      const positions = await contracts.positionManager.getPositions(account);
      const filteredPositions: BigNumber[] = [];
      const activePositions: number[] = [];
      const closedPositions: number[] = [];
      for (const position of positions) {
        const closed = await contracts.positionManager.positionClosed(position);
        if (closed) {
          closedPositions.push(position.toNumber());
        } else {
          activePositions.push(position.toNumber());
        }
        if (closed != active) {
          filteredPositions.push(position);
        }
      }
      if (activePositions.length + closedPositions.length > 6) {
        setNeedSelector(true);
        setUserPositions(active ? activePositions : closedPositions);
      } else {
        setNeedSelector(false);
        setUserPositions(activePositions.concat(closedPositions));
      }
    };
    getPositions();
  }, [contracts, provider, account, active]);

  return (
    <>
      <Flex marginTop={"50px"} direction={"column"} justifyContent={"center"}>
        <Flex
          marginInline={"auto"}
          flexDirection={"column"}
          wrap={"wrap"}
          justifyContent={"center"}
          alignContent={"stretch"}
          maxW={"1000px"}
        >
          <Flex
            p="1"
            display={needSelector ? "flex" : "none"}
            mt={"-10"}
            mb={"4"}
            alignSelf={"end"}
            bgColor={useColorModeValue(...level2)}
            borderRadius="xl"
          >
            <Button
              mr={"1"}
              colorScheme={active ? "blue" : "gray"}
              borderRadius="xl"
              size={"sm"}
              onClick={() => setActive(true)}
            >
              Active Orders
            </Button>
            <Button
              colorScheme={active ? "gray" : "blue"}
              borderRadius="xl"
              size={"sm"}
              onClick={() => setActive(false)}
            >
              Closed Orders
            </Button>
          </Flex>
          <Pagination
            cards={account?userPositions?.map((id) => (
              <Card id={id}></Card>
            )):[]}
            placeholder={
              account?<>
              <Text textAlign={'center'} mt={"20"}>
                No orders detected.{" "}
                <Link href={`/`}>
                  <Text color="blue.500" _hover={{ cursor: "pointer" }} as={"u"}>
                    Click here
                  </Text>
                </Link>{" "}
                to create orders using your assets.
              </Text>
              </>:
              <Text textAlign={'center'} mt={"20"}>
                Please connect wallet
              </Text>
            }
          ></Pagination>
        </Flex>
      </Flex>
    </>
  );
};

export default Positions;
