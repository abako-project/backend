import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('milestones')
@Index(['contractAddress'])
export class Milestone {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  budget: number;

  @Column()
  deliveryTime: number;

  @Column({ nullable: true })
  deliveryDate: number;

  @Column({ nullable: true })
  role: string;

  @Column({ nullable: true })
  proficiency: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column()
  contractAddress: string;

  @Column({ default: false })
  neededFullTimeDeveloper: boolean;

  @Column({ default: false })
  neededPartTimeDeveloper: boolean;

  @Column({ default: false })
  neededHourlyDeveloper: boolean;

  @Column({ nullable: true })
  neededHours: number;

  @Column({ nullable: true })
  developerId: number;

  @Column({ default: 'pending' })
  state: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ type: 'simple-json', default: '[]' })
  skills: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
