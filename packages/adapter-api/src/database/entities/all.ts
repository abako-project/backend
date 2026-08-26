import { User } from './user.entity';
import { Developer } from './developer.entity';
import { Client } from './client.entity';
import { Project } from './project.entity';
import { Milestone } from './milestone.entity';
import { MilestoneAssignment } from './milestone-assignment.entity';
import { Rating } from './rating.entity';
import { Notification } from './notification.entity';

/**
 * Lista única de entidades. La consumen el DatabaseModule (runtime) y el
 * DataSource de la CLI (migraciones): si divergen, se generan migraciones
 * que no reflejan lo que la app carga.
 */
export const ENTITIES = [
  User,
  Developer,
  Client,
  Project,
  Milestone,
  MilestoneAssignment,
  Rating,
  Notification,
];
