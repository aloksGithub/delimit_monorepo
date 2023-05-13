import { CoinbaseWallet } from "@web3-react/coinbase-wallet";
import { GnosisSafe } from "@web3-react/gnosis-safe";
import { MetaMask } from "@web3-react/metamask";
import { Network } from "@web3-react/network";
import { WalletConnect } from "@web3-react/walletconnect";
import type { Connector } from "@web3-react/types";
import { ethers } from "ethers";
import bscAssets from "./protocolData/56.json";
import bscTestnetAssets from "./protocolData/97.json";
import mainnetAssets from "./protocolData/1.json";
import { Asset } from "./Types";

export function getName(connector: Connector) {
  if (connector instanceof MetaMask) return "MetaMask";
  if (connector instanceof WalletConnect) return "WalletConnect";
  if (connector instanceof CoinbaseWallet) return "Coinbase";
  if (connector instanceof Network) return "Network";
  if (connector instanceof GnosisSafe) return "Gnosis Safe";
  return "Unknown";
}

export const chainLogos = {
  1: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=023",
  137: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=023",
  8001: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=023",
  56: "https://seeklogo.com/images/B/binance-coin-bnb-logo-CD94CC6D31-seeklogo.com.png?v=637697418070000000",
  97: "https://seeklogo.com/images/B/binance-coin-bnb-logo-CD94CC6D31-seeklogo.com.png?v=637697418070000000",
  250: "https://cryptologos.cc/logos/fantom-ftm-logo.svg?v=023",
  4002: "https://cryptologos.cc/logos/fantom-ftm-logo.svg?v=023",
  1337: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=023",
};

export const supportedChains = [56, 97];

export const chainNames = {
  1: "Ethereum",
  137: "Matic",
  8001: "Mumbai",
  56: "BSC",
  97: "BSC (Testnet)",
  250: "Fantom",
  4002: "Fantom (Testnet)",
  1337: "Localhost",
};

export const walletLogos = {
  MetaMask: "https://seeklogo.com/images/M/metamask-logo-09EDE53DBD-seeklogo.com.png",
  Coinbase: "https://seeklogo.com/images/C/coinbase-coin-logo-C86F46D7B8-seeklogo.com.png",
  WalletConnect: "https://seeklogo.com/images/W/walletconnect-logo-EE83B50C97-seeklogo.com.png",
};

export const getUnderlyingTokens = async (contracts, token) => {
  const underlying = await contracts.universalSwap.getUnderlying(token);
  return underlying;
};

export const blockExplorers = {
  1: "https://etherscan.io",
  56: "https://bscscan.com",
  250: "https://ftmscan.com",
  137: "https://polygonscan.com",
  97: "https://testnet.bscscan.com",
};

export const blockExplorerAPIs = {
  1: "https://api.etherscan.io",
  56: "https://api.bscscan.com",
  250: "https://api.ftmscan.com",
  137: "https://api.polygonscan.com",
  97: "https://api-testnet.bscscan.com",
};

export const archiveRPCs = {
  56: "https://rpc.ankr.com/bsc",
  97: "https://rpc.ankr.com/bsc_testnet_chapel",
  1: "https://rpc.ankr.com/eth"
}

export const getBlockExplorerUrl = (chainId: number, token: string) => {
  return `${blockExplorers[chainId]}/token/${token}`;
};

export const getBlockExplorerUrlTransaction = (chainId: number, tx: string) => {
  return `${blockExplorers[chainId]}/tx/${tx}`;
};

export function nFormatter(num, digits) {
  if (num === undefined) {
    return "0";
  }
  if (+num < 1) {
    return (+num).toFixed(digits);
  }
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return +num >= item.value;
    });
  return item ? (+num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : "0";
}

const logos = {
  Pancakeswap: "https://cryptologos.cc/logos/pancakeswap-cake-logo.svg?v=023",
  Biswap: "https://cryptologos.cc/logos/biswap-bsw-logo.svg?v=023",
  "Uniswap V2": "https://cryptologos.cc/logos/uniswap-uni-logo.svg?v=023",
  "Uniswap V3": "https://cryptologos.cc/logos/uniswap-uni-logo.svg?v=023",
  Sushiswap: "https://cryptologos.cc/logos/sushiswap-sushi-logo.svg?v=023",
  AAVE: "https://cryptologos.cc/logos/aave-aave-logo.svg?v=023",
};

export const getLogoUrl = (name: string, address: string, chainId: number) => {
  const supportedAssets = supportedChainAssets[chainId];
  const asset = supportedAssets.find((asset) => asset.contract_address.toLowerCase() === address.toLowerCase());
  if (asset) {
    return asset.logo_url.toLowerCase();
  }
  if (address === ethers.constants.AddressZero) {
    return chainLogos[chainId];
  }
  if (name === "Biswap LPs") {
    return logos.Biswap;
  } else if (name === "Pancake LPs") {
    return logos.Pancakeswap;
  } else if (name.includes("Venus")) {
    return "https://logos.covalenthq.com/tokens/56/0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63.png";
  } else if (name.includes("AAVE")) {
    return logos.AAVE;
  } else if (name.includes("Uniswap")) {
    return logos["Uniswap V2"];
  }
  return `https://logos.covalenthq.com/tokens/${chainId}/${address.toLowerCase()}.png`;
};

export const nativeTokens = {
  56: {
    contract_name: "BNB",
    contract_ticker_symbol: "BNB",
    contract_address: ethers.constants.AddressZero,
    contract_decimals: 18,
    underlying: [],
    logo_url: chainLogos[56],
  },
  1: {
    contract_name: "Ether",
    contract_ticker_symbol: "ETH",
    contract_address: ethers.constants.AddressZero,
    contract_decimals: 18,
    underlying: [],
    logo_url: chainLogos[1],
  },
  137: {
    contract_name: "Matic",
    contract_ticker_symbol: "MATIC",
    contract_address: ethers.constants.AddressZero,
    contract_decimals: 18,
    underlying: [],
    logo_url: chainLogos[137],
  },
  250: {
    contract_name: "Fantom",
    contract_ticker_symbol: "FTM",
    contract_address: ethers.constants.AddressZero,
    contract_decimals: 18,
    underlying: [],
    logo_url: chainLogos[250],
  },
};

interface SupportedChainAssets {
  [key: string]: Asset[];
}

export const supportedChainAssets: SupportedChainAssets = {
  // @ts-ignore
  56: bscAssets,
  // @ts-ignore
  97: bscTestnetAssets,
};
