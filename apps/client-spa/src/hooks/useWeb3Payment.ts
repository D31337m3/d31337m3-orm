/**
 * useWeb3Payment — wagmi/ethers wallet connection + deposit address provisioning
 * Connects MetaMask / injected wallets, provisions on-chain deposit addresses,
 * and polls for transaction confirmation.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

interface UseWeb3Payment {
  walletAddress: string | null;
  isConnected: boolean;
  depositAddress: string | null;
  invoiceToken: string | null;
  connectWallet: () => Promise<void>;
  provisionAddress: (amountUSD: number, chainId: number) => Promise<void>;
  verifyPayment: (txHash: string, chainId: number, tokenSymbol: 'USDC' | 'USDT') => Promise<boolean>;
  error: string | null;
}

export function useWeb3Payment(): UseWeb3Payment {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected]     = useState(false);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [invoiceToken, setInvoiceToken]   = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error('No wallet detected. Install MetaMask or another Web3 wallet.');
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setWalletAddress(addr);
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const provisionAddress = useCallback(async (amountUSD: number, chainId: number) => {
    setError(null);
    try {
      const token = localStorage.getItem('d31337m3_token');
      const res = await fetch('/api/payments/crypto/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountUSD, chainId }),
      });
      if (!res.ok) throw new Error('Failed to provision deposit address');
      const data = await res.json();
      setDepositAddress(data.address);
      setInvoiceToken(data.invoiceToken);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const verifyPayment = useCallback(async (
    txHash: string,
    chainId: number,
    tokenSymbol: 'USDC' | 'USDT',
  ): Promise<boolean> => {
    if (!invoiceToken) return false;
    try {
      const token = localStorage.getItem('d31337m3_token');
      const res = await fetch('/api/payments/crypto/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceToken, txHash, chainId, tokenSymbol }),
      });
      const data = await res.json();
      return data.verified === true;
    } catch {
      return false;
    }
  }, [invoiceToken]);

  return { walletAddress, isConnected, depositAddress, invoiceToken, connectWallet, provisionAddress, verifyPayment, error };
}

// Type augmentation for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
