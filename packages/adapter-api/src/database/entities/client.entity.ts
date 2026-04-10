import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

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
