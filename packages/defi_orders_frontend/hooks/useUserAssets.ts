import { BigNumber, constants } from "ethers"
import { formatUnits } from "ethers/lib/utils"
import { useEffect, useState } from "react"
import { SwapContracts, UserAsset } from "../Types"
import { blockExplorerAPIs, supportedChainAssets } from "../utils"
import { getPriceUniversalSwap } from "../contractCalls/dataFetching"
import { ERC20__factory } from "../codegen"

const useUserAssets = (address:string, chainId:number, contracts:SwapContracts, onError: (error:any)=>void, reload: boolean) => {
  const [loading, setLoading] = useState(false)
  const [assets, setAssets] = useState<UserAsset[]>([])

  const fetchTokenDetails = (address: string) => {
    const asset = supportedChainAssets[chainId].find((a) => a.contract_address.toLowerCase()===address?.toLowerCase());
    return asset;
  };

  const fetchAssets = async () => {
    const api = blockExplorerAPIs[chainId]
    if (!address || !contracts || !api) {
      setAssets([])
      setLoading(false)
      return
    }
    const url = `${api}/api?module=account&action=tokentx&address=${address}&page=1&startblock=0&sort=asc&apikey=YourApiKeyToken`
    let response = await (await fetch(url)).json();
    if (!response.message.includes("OK")) {
      if (response.message==='No transactions found') {
        response = {result: []}
      } else {
        onError(response.message)
        setAssets([])
        setLoading(false)
        return
      }
    }
    const transactions = response.result
    let assets: UserAsset[] = []
    for (const transaction of transactions) {
      const idx = assets.findIndex(asset=>asset.contract_address.toLowerCase()===transaction.contractAddress.toLowerCase())
      if (idx==-1) {
        const tokenData = fetchTokenDetails(transaction.contractAddress);
        if (tokenData) {
          assets.push({
            ...tokenData,
            quote: 0,
            quote_rate: 0,
            formattedBalance: '0',
            balance: '0'
          })
        }
      }
    }
    const networkToken = fetchTokenDetails(constants.AddressZero)
    assets.push({...networkToken, quote: 0, quote_rate: 0, formattedBalance: '0', balance: '0'})
    assets = await Promise.all(assets.map(async (asset) => {
      let balance: BigNumber
      if (asset.contract_address!=constants.AddressZero) {
        const token = ERC20__factory.connect(asset.contract_address, contracts.universalSwap.provider)
        balance = await token.balanceOf(address)
      } else {
        balance = await contracts.universalSwap.provider.getBalance(address)
      }
      if (balance.isZero()) return asset
      const { price, decimals } = await getPriceUniversalSwap(contracts, asset.contract_address);
      const formattedBalance = formatUnits(balance, decimals)
      return {
        ...asset,
        quote: price*+formattedBalance,
        quote_rate: price,
        balance: balance.toString(),
        formattedBalance: formattedBalance
      }
    }))
    assets = assets.filter(asset=>+asset.quote>0)
    setAssets(assets)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    fetchAssets()
  }, [address, contracts, chainId, reload])

  return {userAssets: assets, loading}
}

export default useUserAssets