import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './Payment';

@Entity('anchor_records')
export class AnchorRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  paymentId!: string;

  @OneToOne(() => Payment, (payment) => payment.anchorRecord)
  @JoinColumn({ name: 'paymentId' })
  payment!: Payment;

  @Column('text')
  canonicalPayload!: string;

  @Column()
  paymentHash!: string;

  @Column({ default: 'PENDING' })
  anchorStatus!: string; // PENDING, ANCHORED, FAILED

  @Column({ default: 'ganache' })
  network!: string;

  @Column({ nullable: true })
  txHash?: string;

  @Column({ type: 'bigint', nullable: true })
  blockNumber?: number;

  @Column({ type: 'timestamp', nullable: true })
  anchoredAt?: Date;

  @Column({ default: 0 })
  retryCount!: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}