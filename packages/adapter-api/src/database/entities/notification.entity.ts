import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
@Index(['recipientAddress', 'createdAt'])
@Index(['recipientAddress', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  recipientAddress: string;

  @Column()
  type: string;

  @Column({ type: 'text', nullable: true })
  projectId: string | null;

  @Column({ type: 'simple-json' })
  data: unknown;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
