/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  ProvidedHelper,
  ProvidedHelperInterface,
} from "../ProvidedHelper";

const _abi = [
  {
    inputs: [
      {
        internalType: "contract IUniversalSwap",
        name: "_universalSwap",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "address[]",
            name: "tokens",
            type: "address[]",
          },
          {
            internalType: "uint256[]",
            name: "amounts",
            type: "uint256[]",
          },
          {
            components: [
              {
                internalType: "address",
                name: "pool",
                type: "address",
              },
              {
                internalType: "address",
                name: "manager",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
              },
              {
                internalType: "bytes",
                name: "data",
                type: "bytes",
              },
            ],
            internalType: "struct Asset[]",
            name: "nfts",
            type: "tuple[]",
          },
        ],
        internalType: "struct Provided",
        name: "provided",
        type: "tuple",
      },
    ],
    name: "simplifyWithoutWrite",
    outputs: [
      {
        internalType: "address[]",
        name: "simplifiedTokens",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "simplifiedAmounts",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "universalSwap",
    outputs: [
      {
        internalType: "contract IUniversalSwap",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export class ProvidedHelper__factory {
  static readonly abi = _abi;
  static createInterface(): ProvidedHelperInterface {
    return new utils.Interface(_abi) as ProvidedHelperInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ProvidedHelper {
    return new Contract(address, _abi, signerOrProvider) as ProvidedHelper;
  }
}
