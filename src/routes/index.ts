import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { VerificationController } from '../controllers/verification.controller';
import { HealthController } from '../controllers/health.controller';

const router = Router();

const paymentController = new PaymentController();
const verificationController = new VerificationController();
const healthController = new HealthController();

// Health
router.get('/health', healthController.healthCheck.bind(healthController));

// Payments
router.post('/api/payments', paymentController.createPayment.bind(paymentController));
router.get('/api/payments', paymentController.listPayments.bind(paymentController));
router.get('/api/payments/:id', paymentController.getPayment.bind(paymentController));
router.post('/api/payments/:id/complete', paymentController.completePayment.bind(paymentController));

// Verification
router.get('/api/verify/:externalId', verificationController.verifyPayment.bind(verificationController));

export default router;