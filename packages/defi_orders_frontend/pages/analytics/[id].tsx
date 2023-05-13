import { useAppContext } from "../../components/Provider";
import {
  Box,
  Flex,
  Text,
  Grid,
  GridItem,
  useColorModeValue,
  Skeleton,
  TableContainer,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Stack,
  Stat,
  StatArrow,
  StatGroup,
  StatHelpText,
  StatLabel,
  StatNumber,
  Image,
  Button,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useWeb3React } from "@web3-react/core";
import { fetchAllLogs, fetchPosition, FetchPositionData, getGraphData } from "../../contractCalls/dataFetching";
import { fetchImportantPoints } from "../../contractCalls/dataFetching";
import { LineChart, Line, CartesianGrid, Tooltip, XAxis, YAxis, Label } from "recharts";
import { Heading2 } from "../../components/Typography";
import { getBlockExplorerUrlTransaction, getLogoUrl, nFormatter } from "../../utils";
import { level1, level2 } from "../../components/Theme";
import Link from "next/link";

const DaysSelector = ({ setDays, daysSelected }) => {
  return (
    <Flex padding={"3"} backgroundColor={useColorModeValue(...level2)} borderRadius={"xl"}>
      <Button
        w={"30px"}
        h={"30px"}
        p="0"
        mr="2"
        boxSizing="border-box"
        colorScheme={daysSelected === 1 ? "facebook" : "blue"}
        onClick={() => setDays(1)}
      >
        <Text fontSize={"small"}>1d</Text>
      </Button>
      <Button
        w={"30px"}
        h={"30px"}
        p="0"
        mr="2"
        colorScheme={daysSelected === 7 ? "facebook" : "blue"}
        onClick={() => setDays(7)}
      >
        <Text fontSize={"small"}>7d</Text>
      </Button>
      <Button
        w={"30px"}
        h={"30px"}
        p="0"
        mr="2"
        colorScheme={daysSelected === 30 ? "facebook" : "blue"}
        onClick={() => setDays(30)}
      >
        <Text fontSize={"small"}>30d</Text>
      </Button>
      <Button
        w={"30px"}
        h={"30px"}
        p="0"
        mr="2"
        colorScheme={daysSelected === 90 ? "facebook" : "blue"}
        onClick={() => setDays(90)}
      >
        <Text fontSize={"small"}>90d</Text>
      </Button>
      <Button
        w={"30px"}
        h={"30px"}
        p="0"
        colorScheme={daysSelected === -1 ? "facebook" : "blue"}
        onClick={() => setDays(-1)}
      >
        <Text fontSize={"small"}>All</Text>
      </Button>
    </Flex>
  );
};

const Analytics = () => {
  const { contracts, chainId, onError } = useAppContext();
  const { provider, account } = useWeb3React();
  const router = useRouter();
  const { id } = router.query;
  if (typeof(id)!='string') return <></>
  const [position, setPosition] = useState<FetchPositionData>(undefined);
  const [analytics, setAnalytics] = useState(undefined);
  const [roi, setRoi] = useState<string>();
  const [pnl, setPnl] = useState<string>();
  const [graphData, setGraphData] = useState(undefined);
  const [graphDays, setGraphDays] = useState(1);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [logs, setLogs] = useState()

  useEffect(() => {
    if (id && chainId && contracts?.positionManager && !logs) {
      fetchAllLogs(chainId, id, contracts.positionManager).then((data) => setLogs(data))
    }
  }, [contracts, id])

  useEffect(() => {
    const fetch = async () => {
      const data = await getGraphData(contracts, chainId, id, provider, graphDays, logs);
      setGraphData(data);
      setLoadingGraph(false);
    };
    if (contracts && provider && logs) {
      setLoadingGraph(true);
      fetch();
    }
  }, [contracts, provider, id, graphDays, logs]);

  useEffect(() => {
    const fetch = async () => {
      const position = await fetchPosition(parseInt(id), contracts, provider.getSigner(account), chainId);
      const positionData = await fetchImportantPoints(contracts, position.decimals, logs);
      const roi = positionData.usdcWithdrawn + position.usdcValue - positionData.usdcDeposited;
      const pnl = (roi) / 100*positionData.usdcDeposited;
      setRoi(roi.toFixed(2));
      setPnl(pnl.toFixed(2));
      setAnalytics(positionData);
      setPosition(position);
    };
    if (contracts && provider && logs) {
      fetch();
    }
  }, [contracts, provider, id, logs]);

  return (
    <Box maxWidth={"900px"} marginTop={"50px"} marginInline={"auto"}>
      <Box
        maxWidth={"100vw"}
        marginInline={"auto"}
        justifyContent={"space-between"}
        bg={useColorModeValue(...level1)}
        boxShadow={"2xl"}
        rounded={"lg"}
        p={{ base: 3, sm: 6, md: 10 }}
      >
        <Grid gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={"4"} mb={"6"}>
          <Stat display="flex" padding={"4"} backgroundColor={useColorModeValue(...level2)} borderRadius={"xl"}>
            <StatLabel fontSize={"l"}>Asset Value</StatLabel>
            {typeof position?.usdcValue === "number" ? (
              <StatNumber fontSize={{ base: "xl", md: "2xl" }}>${nFormatter(position?.usdcValue, 3)}</StatNumber>
            ) : (
              <Skeleton>Temporary</Skeleton>
            )}
          </Stat>
          <Stat display="flex" padding={"4"} backgroundColor={useColorModeValue(...level2)} borderRadius={"xl"}>
            <StatLabel fontSize={"l"}>PnL</StatLabel>
            <Flex>
              {roi ? (
                <Flex>
                  <StatNumber fontSize={{ base: "xl", md: "2xl" }} mr={"3"}>
                    ${pnl}
                  </StatNumber>
                  <StatHelpText display={"flex"} alignItems={"end"} justifyContent={"start"}>
                    <StatArrow type={+roi < 0 ? "decrease" : "increase"} />
                    {roi}%
                  </StatHelpText>
                </Flex>
              ) : (
                <Skeleton>Temporary</Skeleton>
              )}
            </Flex>
          </Stat>
          <Stat display="flex" padding={"4"} backgroundColor={useColorModeValue(...level2)} borderRadius={"xl"}>
            <StatLabel fontSize={"l"}>Projected APY</StatLabel>
            {typeof position?.usdcValue === "number" ? (
              <StatNumber fontSize={{ base: "xl", md: "2xl" }}>0%</StatNumber>
            ) : (
              <Skeleton>Temporary</Skeleton>
            )}
          </Stat>
          <Stat display="flex" padding={"4"} backgroundColor={useColorModeValue(...level2)} borderRadius={"xl"}>
            <StatLabel fontSize={"l"}>Advertised APY</StatLabel>
            Coming soon
          </Stat>
        </Grid>
        <Flex mt={"12"} justifyContent={"space-between"}>
          <Heading2>Historical Position Value</Heading2>
          <DaysSelector setDays={setGraphDays} daysSelected={graphDays} />
        </Flex>
        <Box style={{ overflow: "auto", maxWidth: "90vw" }} mt={"6"} mb={"12"}>
          {!loadingGraph ? (
            <Box>
              <LineChart width={800} height={450} data={graphData}>
                <XAxis stroke={useColorModeValue("black", "white")} minTickGap={50} dataKey="name"></XAxis>
                <YAxis stroke={useColorModeValue("black", "white")} dataKey={"value"}>
                  <Label
                    offset={10}
                    stroke={useColorModeValue("black", "white")}
                    value="USD Value"
                    position={"insideLeft"}
                    angle={270}
                  />
                </YAxis>
                <Tooltip labelStyle={{ color: "black" }} formatter={(value) => [`$ ${value}`]} />
                {/* <Legend /> */}
                <Line type="monotone" dot={false} dataKey="value" />
              </LineChart>
            </Box>
          ) : (
            <Skeleton height={"450px"}></Skeleton>
          )}
        </Box>
        <Grid w={"100%"} templateColumns={{ base: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }} mb={"8"} gap={10}>
          <GridItem>
            <Heading2>Asset</Heading2>
            {position ? (
              <Flex alignItems={"center"}>
                <Image
                  mr={"2"}
                  rounded="full"
                  width="30px"
                  height={"30px"}
                  src={getLogoUrl(position?.name, position?.tokenContract, chainId)}
                ></Image>
                <Box>
                  <Text>{position?.name}</Text>
                  <Text>
                    {nFormatter(position?.formattedAmount || 0, 3)} tokens (${nFormatter(position.usdcValue, 2)})
                  </Text>
                </Box>
              </Flex>
            ) : (
              <Skeleton width={"60%"} height="20px" />
            )}
          </GridItem>
          <GridItem>
            <Heading2>Underlying Tokens</Heading2>
            {position ? (
              position.underlying.map((underlyingAsset) => (
                <Flex alignItems={"center"}>
                  <Image
                    mr={"2"}
                    rounded={"full"}
                    width="30px"
                    height={"30px"}
                    src={getLogoUrl(underlyingAsset.name, underlyingAsset.address, chainId)}
                  ></Image>
                  <Box mb={"2"}>
                    <Flex alignItems="center">
                      <Text>{underlyingAsset.name}</Text>
                    </Flex>
                    <Text>
                      {nFormatter(underlyingAsset.amount, 2)} tokens (${nFormatter(underlyingAsset.value, 2)})
                    </Text>
                  </Box>
                </Flex>
              ))
            ) : (
              <Stack>
                <Skeleton width={"60%"} height="20px" />
                <Skeleton width={"60%"} height="20px" />
              </Stack>
            )}
          </GridItem>
          {position?.rewards.length > 0 ? (
            <GridItem>
              <Heading2>Underlying Rewards</Heading2>
              {position ? (
                position.rewards.map((reward) => (
                  <Flex alignItems={"center"}>
                    <Image
                      mr={"2"}
                      rounded={"full"}
                      width="30px"
                      height={"30px"}
                      src={getLogoUrl(reward.name, reward.address, chainId)}
                    ></Image>
                    <Box mb={"2"}>
                      <Text>{reward.name}</Text>
                      <Text>
                        {nFormatter(reward.amount, 2)} tokens (${nFormatter(reward.value, 2)})
                      </Text>
                    </Box>
                  </Flex>
                ))
              ) : (
                <Stack>
                  <Skeleton width={"60%"} height="20px" />
                  <Skeleton width={"60%"} height="20px" />
                </Stack>
              )}
            </GridItem>
          ) : (
            <></>
          )}
        </Grid>
        <Heading2>Transactions</Heading2>
        <TableContainer mt={"6"}>
          <Table variant={'unstyled'} borderColor={"red"} size="sm">
            <Thead>
              <Tr borderBottom={'1px'} borderColor={useColorModeValue('gray.300', 'gray.600')}>
                <Th>Date</Th>
                <Th>Transaction Type</Th>
                <Th>Tx Hash</Th>
                <Th>Tokens</Th>
                <Th>USD Value</Th>
              </Tr>
            </Thead>
            <Tbody>
              {analytics?.data.map((transaction) => {
                return (
                  <Tr borderBottom={'1px'} borderColor={useColorModeValue('gray.300', 'gray.600')}>
                    <Td>{transaction.date}</Td>
                    <Td>{transaction.action}</Td>
                    <Td>
                    <a href={getBlockExplorerUrlTransaction(chainId, transaction.txHash)} target="_blank" rel="noopener noreferrer">
                      <Text color={"blue.500"} as="u">
                        {transaction.txHash.slice(0, 5)}...{transaction.txHash.slice(-5)}
                      </Text>
                    </a>
                    </Td>
                    <Td>{nFormatter(transaction.sizeChange, 3)}</Td>
                    <Td>${nFormatter(transaction.usdValue, 3)}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default Analytics;
