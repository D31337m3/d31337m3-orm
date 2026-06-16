/**
 * Web3 Payment Service
 * Validates on-chain USDC/USDT transfers on Polygon and Base.
 * Provisions ephemeral deposit addresses per invoice.
 * Polls Alchemy/QuickNode JSON-RPC to confirm incoming transfer events.
 */

import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.service';

const prisma = new PrismaClient();

// ERC-20 Transfer event ABI (minimal)
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

// Chain configs
interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  usdcAddress: string;
  usdtAddress: string;
  decimals: number;
}

const CHAINS: Record<number, ChainConfig> = {
  137: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
  },
  8453: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdtAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
  },
};

/**
 * Provision a unique deposit address for a crypto payment.
 * In production: generate a deterministic HD wallet address per invoice
 * using a master xpub key so you control the private keys server-side.
 *
 * For simplicity here: generates a random wallet. In prod, use:
 *   const wallet = masterHDWallet.derivePath(`m/44'/60'/0'/0/${invoiceIndex}`)
 */
export async function provisionDepositAddress(params: {
  userId: string;
  amountUSD: number;
  chainId: number;
}): Promise<{ address: string; invoiceToken: string; expiresAt: Date }> {
  const { userId, amountUSD, chainId } = params;

  if (!CHAINS[chainId]) throw new Error(`Unsupported chainId: ${chainId}`);

  // Generate ephemeral wallet — replace with HD derivation in production
  const wallet = ethers.Wallet.createRandom();

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const deposit = await prisma.depositAddress.create({
    data: {
      userId,
      address: wallet.address.toLowerCase(),
      chainId,
      amountUSD,
      expiresAt,
    },
  });

  logger.info(`Deposit address provisioned: ${wallet.address} for user ${userId} ($${amountUSD})`);

  // In production: store wallet.privateKey encrypted in a secure vault (HSM/KMS)
  // NEVER log or return the private key

  return {
    address: wallet.address,
    invoiceToken: deposit.invoiceToken,
    expiresAt,
  };
}

/**
 * Verify a crypto payment by checking on-chain Transfer events.
 * Called by the BullMQ crypto-monitor worker every 30 seconds until confirmed.
 */
export async function verifyOnChainPayment(params: {
  invoiceToken: string;
  txHash: string;
  chainId: number;
  tokenSymbol: 'USDC' | 'USDT';
}): Promise<{ verified: boolean; amountUSD: number | null }> {
  const { invoiceToken, txHash, chainId, tokenSymbol } = params;
  const chain = CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);

  const deposit = await prisma.depositAddress.findUnique({ where: { invoiceToken } });
  if (!deposit) throw new Error('Invoice not found');
  if (deposit.fulfilledAt) return { verified: true, amountUSD: deposit.amountUSD };
  if (deposit.expiresAt < new Date()) throw new Error('Invoice expired');

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const tokenAddress = tokenSymbol === 'USDC' ? chain.usdcAddress : chain.usdtAddress;
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  // Get transaction receipt
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    return { verified: false, amountUSD: null };
  }

  // Parse Transfer events from the receipt
  const iface = new ethers.Interface(ERC20_ABI);
  let transferredAmount = BigInt(0);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (
        parsed?.name === 'Transfer' &&
        parsed.args.to.toLowerCase() === deposit.address.toLowerCase()
      ) {
        transferredAmount += BigInt(parsed.args.value.toString());
      }
    } catch {
      // Not a Transfer event from this contract
    }
  }

  const amountHuman = Number(transferredAmount) / 10 ** chain.decimals;

  if (amountHuman < deposit.amountUSD * 0.99) {
    // Allow 1% tolerance for rounding
    logger.warn(`Insufficient payment: expected $${deposit.amountUSD}, got $${amountHuman}`);
    return { verified: false, amountUSD: amountHuman };
  }

  // Mark fulfilled
  await prisma.depositAddress.update({
    where: { invoiceToken },
    data: { fulfilledAt: new Date() },
  });

  // Record payment
  await prisma.payment.create({
    data: {
      userId: deposit.userId,
      provider: chainId === 137 ? 'CRYPTO_POLYGON' : 'CRYPTO_BASE',
      status: 'CONFIRMED',
      amountCents: Math.round(amountHuman * 100),
      currency: tokenSymbol,
      txHash,
      chainId,
      tokenAddress,
      confirmedAt: new Date(),
    },
  });

  logger.info(`✅ Crypto payment confirmed: $${amountHuman} ${tokenSymbol} on chain ${chainId}`);
  return { verified: true, amountUSD: amountHuman };
}

/**
 * Poll pending deposit addresses and fire confirmations.
 * Called by the BullMQ worker on an interval.
 */
export async function pollPendingDeposits(): Promise<void> {
  const pending = await prisma.depositAddress.findMany({
    where: {
      fulfilledAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  for (const deposit of pending) {
    const chain = CHAINS[deposit.chainId];
    if (!chain) continue;

    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const usdcContract = new ethers.Contract(chain.usdcAddress, ERC20_ABI, provider);

    // Get Transfer events to this address in the last 100 blocks
    try {
      const filter = usdcContract.filters.Transfer(null, deposit.address);
      const latestBlock = await provider.getBlockNumber();
      const events = await usdcContract.queryFilter(filter, latestBlock - 100, latestBlock);

      for (const event of events) {
        const parsed = usdcContract.interface.parseLog({
          topics: event.topics as string[],
          data: event.data,
        });
        if (!parsed) continue;

        const amountHuman = Number(parsed.args.value) / 10 ** 6;
        if (amountHuman >= deposit.amountUSD * 0.99) {
          await prisma.depositAddress.update({
            where: { id: deposit.id },
            data: { fulfilledAt: new Date() },
          });
          await prisma.payment.create({
            data: {
              userId: deposit.userId,
              provider: deposit.chainId === 137 ? 'CRYPTO_POLYGON' : 'CRYPTO_BASE',
              status: 'CONFIRMED',
              amountCents: Math.round(amountHuman * 100),
              currency: 'USDC',
              txHash: event.transactionHash,
              chainId: deposit.chainId,
              tokenAddress: chain.usdcAddress,
              confirmedAt: new Date(),
            },
          });
          logger.info(`💰 Deposit confirmed via poll: ${deposit.address} — $${amountHuman}`);
        }
      }
    } catch (err: any) {
      logger.warn(`Poll error for ${deposit.address}: ${err.message}`);
    }
  }
}
