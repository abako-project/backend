import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BINARY_COLUMN } from '../driver';

@Entity('developers')
export class Developer {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'text', unique: true, nullable: true })
  userId: string | null;

  @Column({ type: 'text', unique: true, nullable: true })
  email: string | null;

  @Column()
  name: string;

  @Column()
  githubUsername: string;

  @Column({ nullable: true })
  portfolioUrl: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  background: string;

  @Column({ default: 'junior' })
  proficiency: string;

  @Column({ nullable: true })
  location: string;

  @Column()
  availability: string;

  @Column({ type: 'simple-json', default: '[]' })
  languages: string[];

  @Column({ nullable: true })
  availableHoursPerWeek: number;

  @Column({ type: BINARY_COLUMN, nullable: true })
  imageData: Buffer;

  @Column({ nullable: true })
  imageMimeType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
