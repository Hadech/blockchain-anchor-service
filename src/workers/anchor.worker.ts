import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { AnchorService } from '../services/anchor.service';
import { logger } from '../utils/logger';

const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

export const anchorQueue = new Queue('anchor-payments', { connection });

const anchorService = new AnchorService();

export const anchorWorker = new Worker(
  'anchor-payments',
  async (job: Job) => {
    const { paymentId } = job.data;
    
    logger.info('Processing anchor job', { jobId: job.id, paymentId });
    
    await anchorService.processPaymentAnchor(paymentId);
    
    return { success: true, paymentId };
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000,
    },
  }
);

anchorWorker.on('completed', (job) => {
  logger.info('Anchor job completed', { jobId: job.id });
});

anchorWorker.on('failed', (job, err) => {
  logger.error('Anchor job failed', {
    jobId: job?.id,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

export async function enqueuePaymentForAnchor(paymentId: string) {
  await anchorQueue.add(
    'anchor-payment',
    { paymentId },
    {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    }
  );
  
  logger.info('Payment enqueued for anchoring', { paymentId });
}