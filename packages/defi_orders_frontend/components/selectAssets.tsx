import { DeleteIcon, AddIcon } from "@chakra-ui/icons";
import {
  useDisclosure,
  IconButton,
  Image,
  Flex,
  Text,
  NumberInput,
  NumberInputField,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  Input,
  Skeleton,
  useColorModeValue,
} from "@chakra-ui/react";
import { BigNumber, ethers } from "ethers";
import { useState, useEffect, useRef } from "react";
import { useAppContext } from "./Provider";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { Reload } from "./Reload";
import { level1, level2 } from "./Theme";
import { Asset, UserAsset, UserAssetSupplied } from "../Types";

export const SelectAsset = ({
  assets,
  asset,
  onSelect,
  placeHolder = "Select",
  higher=false
}: {
  assets: Asset[];
  asset: Asset;
  onSelect: (asset: Asset) => void;
  placeHolder?: string;
  higher?: boolean;
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [filter, setFilter] = useState("");
  const [filteredAssets, setFitleredAssets] = useState(assets);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => ref.current?.scrollIntoView(), 100);
    }
  }, [isOpen]);

  const onSelected = (asset: Asset) => {
    onSelect(asset);
    closeModal();
  };

  const closeModal = () => {
    setFilter("");
    onClose();
  };

  useEffect(() => {
    if (assets?.length > 0) {
      const newFiltered = assets.filter((asset) => {
        if (
          asset.contract_name.toLowerCase().includes(filter.toLowerCase()) ||
          asset.contract_address.toLowerCase().includes(filter.toLowerCase())
        ) {
          return true;
        }
        return false;
      });
      setFitleredAssets(newFiltered);
    }
  }, [filter, assets]);

  const onInput = (input: string) => {
    setFilter(input);
  };

  const ref = useRef(null);

  return (
    <Box>
      <Box>
        <Button
          onClick={onOpen}
          alignItems={"center"}
          justifyContent={"center"}
          paddingInline="2"
          bgColor={useColorModeValue(higher?'gray.300':'gray.200', higher?'gray.600':'gray.700')}
          _hover={{bgColor: useColorModeValue(higher?'gray.400':'gray.300', higher?'gray.500':'gray.600')}}
          _active={{bgColor: useColorModeValue(higher?'gray.500':'gray.400', higher?'gray.400':'gray.500')}}
          color={useColorModeValue('black', 'white')}
          paddingBlock={"1"}
          borderRadius={"2xl"}
        >
          {asset?.contract_ticker_symbol ? (
            <>
              &nbsp;&nbsp;
              <Image
                src={asset.logo_url.toLowerCase()}
                w="20px"
                h="20px"
                borderRadius={"15px"}
                fallbackSrc="https://www.svgrepo.com/show/99387/dollar.svg"
              />
              <Text ml={"3"} fontSize={"l"}>
                {asset.contract_ticker_symbol} <ChevronDownIcon />
              </Text>
            </>
          ) : (
            <Text fontSize={"l"}>
              &nbsp;&nbsp;{placeHolder}
              <ChevronDownIcon />
            </Text>
          )}
        </Button>
      </Box>
      <Modal isCentered isOpen={isOpen} onClose={closeModal}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent bgColor={useColorModeValue(...level1)}>
          <ModalHeader>Select {placeHolder === "Select" ? "asset" : placeHolder}</ModalHeader>
          <ModalCloseButton />
          <ModalBody padding={"6"}>
            <Input
              mb={"4"}
              placeholder="Search asset by name or address"
              onChange={(event) => onInput(event.target.value)}
            />
            <Box overflow={"auto"} maxHeight={"400px"} marginTop={"3"}>
              {filteredAssets?.map((selectableAsset) => {
                const chosenOne =
                  selectableAsset.contract_address?.toLowerCase() === asset?.contract_address?.toLowerCase();
                return (
                  <Flex
                    _hover={{ cursor: "pointer", backgroundColor: useColorModeValue(...level2) }}
                    ref={chosenOne ? ref : undefined}
                    backgroundColor={chosenOne ? useColorModeValue(...level2) : useColorModeValue(...level1)}
                    padding="2"
                    onClick={() => onSelected(selectableAsset)}
                  >
                    <Image
                      src={selectableAsset.logo_url.toLowerCase()}
                      w="20px"
                      h="20px"
                      borderRadius={"15px"}
                      fallbackSrc="https://www.svgrepo.com/show/99387/dollar.svg"
                    />
                    <Text ml={"3"}>{selectableAsset.contract_name}</Text>
                  </Flex>
                );
              })}
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

const SelectableAsset = ({
  i,
  asset,
  assets,
  setAsset,
  setSupply,
  removeAsset,
}: {
  i: number;
  asset: UserAssetSupplied;
  assets: UserAsset[];
  setAsset: (i: number, asset: Asset) => void;
  setSupply: Function;
  removeAsset: Function;
}) => {
  const {
    userAssets: { loading },
  } = useAppContext();
  const [supplied, setSupplied] = useState(asset.tokensSupplied?.toString() || "0");

  useEffect(() => {
    setSupply(i, supplied);
  }, [supplied]);

  const setMax = () => {
    if (!asset.formattedBalance) return;
    setSupplied(asset.formattedBalance);
  };

  const onSelect = (asset: Asset) => {
    setAsset(i, asset);
  };

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
        <SelectAsset asset={asset} onSelect={onSelect} assets={assets} />
        <Flex alignItems={"center"} mt={"3"}>
          <Text
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
        </Flex>
      </Box>
      <Flex flexDirection={"column"} alignItems={"end"} textAlign={"end"}>
        <Flex>
          Balance:{" "}
          {!loading ? (
            (+ethers.utils.formatUnits(asset?.balance || 0, asset?.contract_decimals || 1)).toFixed(3)
          ) : (
            <Skeleton ml={"2"}>Temporary</Skeleton>
          )}
          <Text
            paddingInline={"1"}
            backgroundColor="blue.500"
            color={"white"}
            ml={"2"}
            _hover={{ cursor: "pointer", backgroundColor: "blue.300" }}
            onClick={setMax}
          >
            Max
          </Text>
        </Flex>
        <NumberInput
          py="2"
          value={supplied}
          size="lg"
          maxW={32}
          borderStyle="hidden"
          min={0}
          max={+ethers.utils.formatUnits(asset?.balance || 0, asset?.contract_decimals || 1)}
          defaultValue={0}
          onChange={(valueAsString) => setSupplied(valueAsString)}
        >
          <NumberInputField
            fontSize={"2xl"}
            textAlign={"end"}
            pr={"0"}
            boxShadow="none"
            outline={"none"}
            borderStyle="hidden"
            _hover={{ borderStyle: "hidden" }}
            _active={{ borderStyle: "hidden", borderTopColor: "pink.100", borderColor: "gray.100", boxShadow: "none" }}
          />
        </NumberInput>
        {!loading ? <Text>${(asset.usdcValue || 0).toFixed(3)}</Text> : <Skeleton>Temporary</Skeleton>}
      </Flex>
    </Flex>
  );
};

export const SupplyAssets = ({
  assetsToConvert,
  setAssetsToConvert,
}: {
  assetsToConvert: UserAssetSupplied[];
  setAssetsToConvert: Function;
}) => {
  const { userAssets, hardRefreshAssets } = useAppContext();
  const assets: UserAssetSupplied[] = userAssets?.data;
  const loading = userAssets?.loading;

  // const [assetsToConvert, setAssetsToConvert] = useState<any>([{}])
  const filteredAssets = assets?.filter(
    (asset) =>
      !(assetsToConvert.filter((toConvert) => toConvert.contract_address === asset.contract_address).length > 0)
  );

  useEffect(() => {
    if (assets?.length > 0 && !loading) {
      const newAssets = assetsToConvert.map((asset) => {
        const matchingAsset = assets.find((reloadedAsset) => reloadedAsset.contract_address === asset.contract_address);
        if (matchingAsset && matchingAsset.balance) {
          const balance = ethers.utils.formatUnits(matchingAsset.balance, matchingAsset.contract_decimals);
          const usdAvailable = matchingAsset.quote;
          const usdSupplied = (usdAvailable * +asset.tokensSupplied) / parseFloat(balance);
          return { ...asset, balance: matchingAsset.balance, quote: matchingAsset.quote, usdcValue: usdSupplied };
        } else {
          return {};
        }
      });
      setAssetsToConvert(newAssets);
    } else {
    }
  }, [userAssets]);

  // useEffect(() => {
  //   onChange(assetsToConvert)
  // }, [assetsToConvert])

  const addAsset = () => {
    setAssetsToConvert([...assetsToConvert, {}]);
  };
  const removeAsset = (i: number) => {
    if (assetsToConvert.length === 1) return;
    const tempAssets = [...assetsToConvert];
    tempAssets[i].tokensSupplied = "0";
    tempAssets[i].usdcValue = 0;
    tempAssets.splice(i, 1);
    setAssetsToConvert(tempAssets);
  };

  const setSupply = (i: number, tokens: string) => {
    const temp = [...assetsToConvert];
    temp[i].tokensSupplied = tokens;
    const assetDetails = temp[i];
    const balance = assetDetails.contract_decimals
      ? ethers.utils.formatUnits(assetDetails.balance, assetDetails.contract_decimals)
      : "0";
    const usdAvailable = assetDetails.quote;
    const usdSupplied = (usdAvailable * +tokens) / parseFloat(balance);
    temp[i].usdcValue = usdSupplied;
    setAssetsToConvert(temp);
  };

  const setAsset = (i: number, asset: UserAssetSupplied) => {
    const temp = [...assetsToConvert];
    temp[i] = asset;
    temp[i].tokensSupplied = "0";
    temp[i].usdcValue = 0;
    setAssetsToConvert(temp);
  };

  return (
    <Box
      padding={"5"}
      width={"100%"}
      maxWidth="450px"
      bg="hidden"
      alignItems={"center"}
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
          onClick={addAsset}
          icon={<AddIcon />}
        />
        <Text>USD Supplied: ${assetsToConvert.reduce((a, b) => a + (b.usdcValue || 0), 0)?.toFixed(3) || 0}</Text>
        <Reload onReload={hardRefreshAssets} loading={loading} />
      </Flex>
      {assetsToConvert.map((asset, index) =>
        asset ? (
          <SelectableAsset
            key={`SuppliedAsset_${index}`}
            asset={asset}
            i={index}
            assets={filteredAssets}
            removeAsset={removeAsset}
            setSupply={setSupply}
            setAsset={setAsset}
          ></SelectableAsset>
        ) : (
          <></>
        )
      )}
    </Box>
  );
};
