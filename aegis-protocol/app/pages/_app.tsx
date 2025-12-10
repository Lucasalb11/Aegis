import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { WalletProvider } from '../components/WalletProvider'
import { AegisProvider } from '../components/AegisProvider'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <AegisProvider>
        <Component {...pageProps} />
      </AegisProvider>
    </WalletProvider>
  )
}