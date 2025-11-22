import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Payment } from '../models';
import { enqueuePaymentForAnchor } from '../workers/anchor.worker';
import { logger } from '../utils/logger';

const paymentRepo = AppDataSource.getRepository(Payment);

export class PaymentController {
  /**
   * POST /api/payments
   * Crea un nuevo pago
   */
  async createPayment(req: Request, res: Response) {
    try {
      const {
        externalId,
        payerId,
        beneficiaryId,
        amountMinorUnits,
        currency,
      } = req.body;

      const payment = paymentRepo.create({
        externalId,
        payerId,
        beneficiaryId,
        amountMinorUnits,
        currency,
        status: 'PENDING',
      });

      await paymentRepo.save(payment);

      logger.info('Payment created', { paymentId: payment.id, externalId });

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      logger.error('Error creating payment', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/payments/:id/complete
   * Marca un pago como completado y lo encola para anclaje
   */
  async completePayment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { bankReference } = req.body;

      const payment = await paymentRepo.findOne({ where: { id } });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      payment.status = 'COMPLETED';
      payment.bankReference = bankReference;
      payment.executedAt = new Date();

      await paymentRepo.save(payment);

      // Encolar para anclaje
      await enqueuePaymentForAnchor(payment.id);

      logger.info('Payment completed and enqueued', { paymentId: payment.id });

      res.json({
        success: true,
        data: payment,
        message: 'Payment completed and enqueued for blockchain anchoring',
      });
    } catch (error: any) {
      logger.error('Error completing payment', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/payments/:id
   * Obtiene un pago por ID
   */
  async getPayment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payment = await paymentRepo.findOne({
        where: { id },
        relations: ['anchorRecord'],
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      logger.error('Error getting payment', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/payments
   * Lista todos los pagos
   */
  async listPayments(req: Request, res: Response) {
    try {
      const payments = await paymentRepo.find({
        relations: ['anchorRecord'],
        order: { createdAt: 'DESC' },
        take: 50,
      });

      res.json({
        success: true,
        data: payments,
        count: payments.length,
      });
    } catch (error: any) {
      logger.error('Error listing payments', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}