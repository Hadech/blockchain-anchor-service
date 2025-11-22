import { AppDataSource } from '../config/database';
import { Payment, AnchorRecord } from '../models';
import { CanonicalizerService, CanonicalPaymentData } from './canonicalizer.service';
import { BlockchainService } from './blockchain.service';
import { logger } from '../utils/logger';

export class AnchorService {
  private paymentRepo = AppDataSource.getRepository(Payment);
  private anchorRepo = AppDataSource.getRepository(AnchorRecord);
  private blockchainService: BlockchainService;

  constructor() {
    this.blockchainService = new BlockchainService();
  }

  /**
   * Procesa el anclaje de un pago
   */
  async processPaymentAnchor(paymentId: string): Promise<void> {
    try {
      logger.info('Processing payment anchor', { paymentId });

      // 1. Obtener pago
      const payment = await this.paymentRepo.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      if (payment.status !== 'COMPLETED') {
        throw new Error(`Payment ${paymentId} is not completed`);
      }

      // 2. Verificar si ya existe un registro de anclaje
      let anchorRecord = await this.anchorRepo.findOne({
        where: { paymentId },
      });

      if (anchorRecord && anchorRecord.anchorStatus === 'ANCHORED') {
        logger.warn('Payment already anchored', { paymentId });
        return;
      }

      // 3. Generar payload canónico y hash
      const canonicalData: CanonicalPaymentData = {
        version: '1.0',
        externalId: payment.externalId,
        payerId: CanonicalizerService.hashId(payment.payerId),
        beneficiaryId: CanonicalizerService.hashId(payment.beneficiaryId),
        amountMinorUnits: payment.amountMinorUnits.toString(),
        currency: payment.currency,
        executedAt: payment.executedAt!.toISOString(),
        bankReference: payment.bankReference || '',
      };

      const { canonicalPayload, paymentHash } =
        CanonicalizerService.generatePaymentHash(canonicalData);

      logger.info('Generated payment hash', { paymentId, paymentHash });

      // 4. Crear o actualizar registro de anclaje
      if (!anchorRecord) {
        anchorRecord = this.anchorRepo.create({
          paymentId,
          canonicalPayload,
          paymentHash,
          anchorStatus: 'PENDING',
          network: 'ganache',
        });
        await this.anchorRepo.save(anchorRecord);
      } else {
        anchorRecord.canonicalPayload = canonicalPayload;
        anchorRecord.paymentHash = paymentHash;
        anchorRecord.anchorStatus = 'PENDING';
        anchorRecord.retryCount += 1;
        await this.anchorRepo.save(anchorRecord);
      }

      // 5. Anclar en blockchain
      const executedAtUnix = Math.floor(payment.executedAt!.getTime() / 1000);

      const { txHash, blockNumber } = await this.blockchainService.anchorPayment(
        paymentHash,
        payment.externalId,
        BigInt(payment.amountMinorUnits),
        payment.currency,
        executedAtUnix
      );

      // 6. Actualizar registro
      anchorRecord.anchorStatus = 'ANCHORED';
      anchorRecord.txHash = txHash;
      anchorRecord.blockNumber = blockNumber;
      anchorRecord.anchoredAt = new Date();
      await this.anchorRepo.save(anchorRecord);

      // 7. Actualizar estado del pago
      payment.status = 'ANCHORED';
      await this.paymentRepo.save(payment);

      logger.info('Payment anchored successfully', {
        paymentId,
        txHash,
        blockNumber,
      });
    } catch (error: any) {
      logger.error('Error processing payment anchor', {
        paymentId,
        error: error.message,
      });

      // Actualizar registro con error
      const anchorRecord = await this.anchorRepo.findOne({
        where: { paymentId },
      });

      if (anchorRecord) {
        anchorRecord.anchorStatus = 'FAILED';
        anchorRecord.lastError = error.message;
        anchorRecord.retryCount += 1;
        await this.anchorRepo.save(anchorRecord);
      }

      throw error;
    }
  }

  /**
   * Verifica el anclaje de un pago
   */
  async verifyPaymentAnchor(externalId: string): Promise<any> {
    const payment = await this.paymentRepo.findOne({
      where: { externalId },
      relations: ['anchorRecord'],
    });

    if (!payment) {
      return { found: false };
    }

    if (!payment.anchorRecord) {
      return {
        found: true,
        payment: {
          externalId: payment.externalId,
          status: payment.status,
          amount: payment.amountMinorUnits,
          currency: payment.currency,
        },
        isAnchored: false,
      };
    }

    const anchorRecord = payment.anchorRecord;

    // Verificar hash localmente
    const isHashValid = CanonicalizerService.verifyPayload(
      anchorRecord.canonicalPayload,
      anchorRecord.paymentHash
    );

    // Verificar on-chain
    const onChainVerification = await this.blockchainService.verifyAnchor(
      anchorRecord.paymentHash
    );

    return {
      found: true,
      payment: {
        externalId: payment.externalId,
        status: payment.status,
        amount: payment.amountMinorUnits,
        currency: payment.currency,
        executedAt: payment.executedAt,
      },
      anchor: {
        status: anchorRecord.anchorStatus,
        paymentHash: anchorRecord.paymentHash,
        txHash: anchorRecord.txHash,
        blockNumber: anchorRecord.blockNumber,
        anchoredAt: anchorRecord.anchoredAt,
        network: anchorRecord.network,
      },
      verification: {
        localHashValid: isHashValid,
        onChainConfirmed: onChainVerification.isAnchored,
        onChainRecord: onChainVerification.record,
      },
    };
  }
}