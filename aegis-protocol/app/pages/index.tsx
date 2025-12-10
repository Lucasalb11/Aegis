import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useAegis } from '../hooks/useAegis'

export default function Home() {
  const { publicKey } = useWallet()
  const { pools, createPool, addLiquidity } = useAegis()
  const [loading, setLoading] = useState(false)

  const handleCreatePool = async () => {
    if (!publicKey) return

    setLoading(true)
    try {
      await createPool()
      alert('Pool created successfully!')
    } catch (error) {
      console.error('Error creating pool:', error)
      alert('Error creating pool')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLiquidity = async (poolId: string) => {
    setLoading(true)
    try {
      await addLiquidity(poolId, 1000, 1000) // Example amounts
      alert('Liquidity added successfully!')
    } catch (error) {
      console.error('Error adding liquidity:', error)
      alert('Error adding liquidity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Aegis Protocol</h1>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {!publicKey ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Connect your wallet to get started</h2>
              <WalletMultiButton />
            </div>
          ) : (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Create Pool</h2>
                <button
                  onClick={handleCreatePool}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create New Pool'}
                </button>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Pools</h2>
                {pools.length === 0 ? (
                  <p className="text-gray-500">No pools found. Create your first pool!</p>
                ) : (
                  <div className="grid gap-4">
                    {pools.map((pool) => (
                      <div key={pool.id} className="bg-white p-4 rounded-lg shadow">
                        <h3 className="font-semibold">Pool {pool.id.slice(0, 8)}...</h3>
                        <p>LP Supply: {pool.lpSupply}</p>
                        <button
                          onClick={() => handleAddLiquidity(pool.id)}
                          disabled={loading}
                          className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                        >
                          Add Liquidity
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}