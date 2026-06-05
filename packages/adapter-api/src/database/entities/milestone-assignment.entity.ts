import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('milestone_assignments')
@Index(['projectId'])
@Index(['contractAddress', 'milestoneId'])
@Index(['developerId'])
@Index(['contractAddress', 'milestoneId', 'assignmentKey'], { unique: true })
export class MilestoneAssignment {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  projectId: string;

  @Column()
  contractAddress: string;

  @Column()
  milestoneId: number;

  @Column()
  developerId: number;

  @Column()
  accountId: string;

  @Column({ type: 'text', nullable: true })
  assignmentKey: string | null;

  @Column({ default: 0 })
  hours: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
