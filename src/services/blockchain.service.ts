import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';
import contractABI from '../../contracts/artifacts/contracts/FiatPaymentsAnchor.sol/FiatPaymentsAnchor.json';

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
    
    if (!config.blockchain.contractAddress) {
      throw new Error('Contract address not configured');
    }

    this.contract = new ethers.Contract(
      config.blockchain.contractAddress,
      contractABI.abi,
      this.wallet
    );

    logger.info('Blockchain service initialized', {
      rpcUrl: config.blockchain.rpcUrl,
      contractAddress: config.blockchain.contractAddress,
      walletAddress: this.wallet.address,
    });
  }

  /**
   * Ancla un pago en la blockchain
   */
  async anchorPayment(
    paymentHash: string,
    offchainId: string,
    amountMinorUnits: bigint,
    currency: string,
    executedAt: number
  ): Promise<{ txHash: string; blockNumber: number }> {
    try {
      logger.info('Anchoring payment on blockchain', {
        paymentHash,
        offchainId,
        amountMinorUnits: amountMinorUnits.toString(),
        currency,
        executedAt,
      });

      const tx = await this.contract.anchorPayment(
        paymentHash,
        offchainId,
        amountMinorUnits,
        currency,
        executedAt,
        {
          gasLimit: 200000,
        }
      );

      logger.info('Transaction sent', { txHash: tx.hash });

      const receipt = await tx.wait(1);

      if (receipt.status !== 1) {
        throw new Error('Transaction reverted');
      }

      logger.info('Payment anchored successfully', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error('Error anchoring payment', {
        error: error.message,
        paymentHash,
      });
      throw error;
    }
  }

  /**
   * Verifica si un pago está anclado
   */
  async verifyAnchor(paymentHash: string): Promise<{
    isAnchored: boolean;
    record?: any;
  }> {
    try {
      const [exists, record] = await this.contract.getAnchor(paymentHash);

      return {
        isAnchored: exists,
        record: exists ? {
          paymentHash: record.paymentHash,
          offchainId: record.offchainId,
          amountMinorUnits: record.amountMinorUnits.toString(),
          currency: record.currency,
          executedAt: Number(record.executedAt),
          anchoredAt: Number(record.anchoredAt),
          anchoredBy: record.anchoredBy,
        } : undefined,
      };
    } catch (error: any) {
      logger.error('Error verifying anchor', {
        error: error.message,
        paymentHash,
      });
      throw error;
    }
  }

  /**
   * Obtiene el balance de la wallet
   */
  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Obtiene información del contrato
   */
  async getContractInfo(): Promise<{
    address: string;
    owner: string;
    totalAnchored: number;
    version: string;
  }> {
    const [owner, totalAnchored, version] = await Promise.all([
      this.contract.owner(),
      this.contract.totalAnchored(),
      this.contract.version(),
    ]);

    return {
      address: await this.contract.getAddress(),
      owner,
      totalAnchored: Number(totalAnchored),
      version,
    };
  }
}