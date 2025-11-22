import 'reflect-metadata';
import { createApp } from './app';
import { config } from './config';
import { initializeDatabase } from './config/database';
import { logger } from './utils/logger';
import { anchorWorker } from './workers/anchor.worker';

async function startServer() {
  try {
    // Inicializar base de datos
    await initializeDatabase();

    // Crear aplicación
    const app = createApp();

    // Iniciar servidor
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔗 Blockchain RPC: ${config.blockchain.rpcUrl}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      await anchorWorker.close();
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();