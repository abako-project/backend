import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SQLiteSessionStorage } from './storage';

@Injectable()
export class StorageMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Use a single global storage instance for all users
    req.storage = SQLiteSessionStorage.getInstance('global');
    next();
  }
} 