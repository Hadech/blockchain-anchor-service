import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { BlockchainService } from '../services/blockchain.service';
import { logger } from '../utils/logger';

export class HealthController {
  /**
   * GET /health
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response) {
    try {
      const dbConnected = AppDataSource.isInitialized;
      
      let blockchainInfo;
      try {
        const blockchainService = new BlockchainService();
        blockchainInfo = await blockchainService.getContractInfo();
      } catch (error) {
        blockchainInfo = { error: 'Not connected' };
      }

      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbConnected ? 'connected' : 'disconnected',
        blockchain: blockchainInfo,
      };

      res.json(health);
    } catch (error: any) {
      logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        status: 'error',
        error: error.message,
      });
    }
  }
}