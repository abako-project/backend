import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', unique: true, nullable: true })
  userId: string | null;

  @Column({ type: 'text', unique: true, nullable: true })
  email: string | null;

  @Column()
  company: string;

  @Column()
  department: string;

  @Column()
  website: string;

  @Column()
  description: string;

  @Column()
  location: string;

  @Column({ type: 'simple-json', default: '[]' })
  languages: string[];

  @Column({ type: 'blob', nullable: true })
  imageData: Buffer;

  @Column({ nullable: true })
  imageMimeType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
