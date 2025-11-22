import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { AnchorRecord } from './AnchorRecord';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  externalId!: string;

  @Column()
  payerId!: string;

  @Column()
  beneficiaryId!: string;

  @Column('bigint')
  amountMinorUnits!: number;

  @Column({ length: 3 })
  currency!: string;

  @Column({ default: 'PENDING' })
  status!: string; // PENDING, PROCESSING, COMPLETED, ANCHORED, FAILED

  @Column({ nullable: true })
  bankReference?: string;

  @Column({ type: 'timestamp', nullable: true })
  executedAt?: Date;

  @OneToOne(() => AnchorRecord, (anchor) => anchor.payment)
  anchorRecord?: AnchorRecord;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}