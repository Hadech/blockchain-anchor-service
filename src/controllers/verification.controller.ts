import { Request, Response } from 'express';
import { AnchorService } from '../services/anchor.service';
import { logger } from '../utils/logger';

const anchorService = new AnchorService();

export class VerificationController {
  /**
   * GET /api/verify/:externalId
   * Verifica el anclaje de un pago
   */
  async verifyPayment(req: Request, res: Response) {
    try {
      const { externalId } = req.params;

      logger.info('Verifying payment', { externalId });

      const result = await anchorService.verifyPaymentAnchor(externalId);

      if (!result.found) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error verifying payment', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}