import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'text', unique: true })
  name: string;

  @Column({ type: 'text', default: 'software' })
  category: 'software' | 'soft';

  @CreateDateColumn()
  createdAt: Date;
}
