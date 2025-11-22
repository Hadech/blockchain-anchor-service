import crypto from 'crypto';

export interface CanonicalPaymentData {
  version: string;
  externalId: string;
  payerId: string;
  beneficiaryId: string;
  amountMinorUnits: string;
  currency: string;
  executedAt: string;
  bankReference: string;
}

export class CanonicalizerService {
  private static readonly VERSION = '1.0';

  /**
   * Construye el payload canónico ordenado alfabéticamente
   */
  static buildCanonicalPayload(data: CanonicalPaymentData): string {
    const orderedData = {
      amountMinorUnits: data.amountMinorUnits,
      bankReference: data.bankReference,
      beneficiaryId: data.beneficiaryId,
      currency: data.currency,
      executedAt: data.executedAt,
      externalId: data.externalId,
      payerId: data.payerId,
      version: data.version,
    };

    return JSON.stringify(orderedData);
  }

  /**
   * Calcula el hash SHA-256 del payload
   */
  static hashPayload(canonicalPayload: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(canonicalPayload, 'utf8')
      .digest('hex');
    
    return `0x${hash}`;
  }

  /**
   * Genera hash completo desde datos de pago
   */
  static generatePaymentHash(data: CanonicalPaymentData): {
    canonicalPayload: string;
    paymentHash: string;
  } {
    const canonicalPayload = this.buildCanonicalPayload(data);
    const paymentHash = this.hashPayload(canonicalPayload);
    
    return { canonicalPayload, paymentHash };
  }

  /**
   * Verifica que un payload coincida con un hash
   */
  static verifyPayload(canonicalPayload: string, expectedHash: string): boolean {
    const computedHash = this.hashPayload(canonicalPayload);
    return computedHash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Hash de IDs para privacidad
   */
  static hashId(id: string): string {
    return crypto.createHash('sha256').update(id).digest('hex').slice(0, 16);
  }
}