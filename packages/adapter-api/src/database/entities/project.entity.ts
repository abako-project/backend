import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  summary: string;

  @Column({ nullable: true })
  projectType: number;

  @Column({ default: 'draft' })
  state: string;

  @Column({ nullable: true })
  url: string;

  @Column({ nullable: true })
  budget: number;

  @Column({ nullable: true })
  deliveryTime: number;

  @Column({ nullable: true })
  deliveryDate: number;

  @Column({ nullable: true })
  proposalRejectionReason: string;

  @Column()
  clientId: string;

  @Column({ nullable: true })
  consultantId: string;

  @Column({ unique: true, nullable: true })
  contractAddress: string;

  @Column({ nullable: true })
  calendarContract: string;

  @Column({ nullable: true })
  coordinatorApprovalStatus: string;

  @Column({ nullable: true })
  coordinatorRejectionReason: string;

  @Column({ default: 'created' })
  creationStatus: string;

  @Column({ type: 'varchar', nullable: true })
  creationError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
