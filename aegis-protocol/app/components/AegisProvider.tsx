'use client'

import { FC, ReactNode, createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Aegis, Pool, PoolInfo } from '@aegis/sdk'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

interface AegisPool {
  id: string
  info: PoolInfo
  instance: Pool
}

interface AegisContextType {
  aegis: Aegis | null
  pools: AegisPool[]
  loading: boolean
  createPool: (mintA: string, mintB: string, feeBps?: number) => Promise<void>
  addLiquidity: (poolId: string, amountA: number, amountB: number) => Promise<void>
  removeLiquidity: (poolId: string, amount: number) => Promise<void>
  swap: (poolId: string, amountIn: number, minAmountOut: number, aToB: boolean) => Promise<void>
  refreshPools: () => Promise<void>
}

const AegisContext = createContext<AegisContextType | undefined>(undefined)

export const AegisProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { connection } = useConnection()
  const [pools, setPools] = useState<AegisPool[]>([])
  const [loading, setLoading] = useState(false)

  const aegis = useMemo(() => {
    if (!publicKey || !signTransaction) return null

    const wallet = {
      publicKey,
      signTransaction,
      signAllTransactions: signAllTransactions || (() => Promise.resolve([])),
    }

    return Aegis.fromWallet(connection, wallet as any)
  }, [publicKey, signTransaction, signAllTransactions, connection])

  const refreshPools = async () => {
    if (!aegis) return

    setLoading(true)
    try {
      const allPools = await aegis.getPools()
      const aegisPools: AegisPool[] = allPools.map((pool, index) => ({
        id: `pool_${index}`,
        info: pool.info,
        instance: pool,
      }))
      setPools(aegisPools)
    } catch (error) {
      console.error('Failed to refresh pools:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshPools()
  }, [aegis])

  const createPool = async (mintA: string, mintB: string, feeBps: number = 30) => {
    if (!aegis) throw new Error('Aegis not initialized')

    setLoading(true)
    try {
      const mintAPubkey = new PublicKey(mintA)
      const mintBPubkey = new PublicKey(mintB)

      const pool = await aegis.getOrCreatePool(mintAPubkey, mintBPubkey, feeBps)

      const newAegisPool: AegisPool = {
        id: pool.info.address.toString(),
        info: pool.info,
        instance: pool,
      }

      setPools(prev => [...prev, newAegisPool])
      console.log('Pool created:', newAegisPool)
    } catch (error) {
      console.error('Failed to create pool:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const addLiquidity = async (poolId: string, amountA: number, amountB: number) => {
    if (!aegis) throw new Error('Aegis not initialized')

    const pool = pools.find(p => p.id === poolId)
    if (!pool) throw new Error('Pool not found')

    setLoading(true)
    try {
      // In a real implementation, these would be actual token accounts
      const userTokenA = PublicKey.default // Placeholder
      const userTokenB = PublicKey.default // Placeholder
      const userLpToken = PublicKey.default // Placeholder

      await pool.instance.addLiquidity({
        amountA: new BN(amountA),
        amountB: new BN(amountB),
      }, userTokenA, userTokenB, userLpToken)

      await refreshPools()
    } catch (error) {
      console.error('Failed to add liquidity:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const removeLiquidity = async (poolId: string, amount: number) => {
    if (!aegis) throw new Error('Aegis not initialized')

    // Remove liquidity implementation would go here
    console.log(`Remove liquidity from pool ${poolId}: ${amount}`)
  }

  const swap = async (poolId: string, amountIn: number, minAmountOut: number, aToB: boolean) => {
    if (!aegis) throw new Error('Aegis not initialized')

    const pool = pools.find(p => p.id === poolId)
    if (!pool) throw new Error('Pool not found')

    setLoading(true)
    try {
      // In a real implementation, these would be actual token accounts
      const userSource = PublicKey.default // Placeholder
      const userDestination = PublicKey.default // Placeholder

      await pool.instance.swap({
        amountIn: new BN(amountIn),
        minAmountOut: new BN(minAmountOut),
        aToB,
      }, userSource, userDestination)

      await refreshPools()
    } catch (error) {
      console.error('Failed to swap:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <AegisContext.Provider
      value={{
        aegis,
        pools,
        loading,
        createPool,
        addLiquidity,
        removeLiquidity,
        swap,
        refreshPools,
      }}
    >
      {children}
    </AegisContext.Provider>
  )
}

export const useAegis = () => {
  const context = useContext(AegisContext)
  if (context === undefined) {
    throw new Error('useAegis must be used within an AegisProvider')
  }
  return context
}