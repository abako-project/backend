import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('ratings')
@Index(['clientId'])
@Index(['developerId'])
@Index(['projectId'])
@Index(['clientId', 'developerId'])
export class Rating {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  projectId: string;

  @Column()
  clientId: string;

  @Column()
  developerId: string;

  @Column()
  rating: number;

  @Column({ nullable: true })
  contractAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
