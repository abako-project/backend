import { StoredData } from './types';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SQLite-based storage for the VOS mock service with persistent volume support
 */
export class SQLiteSessionStorage {
  private static instances: Map<string, SQLiteSessionStorage> = new Map();
  private db: sqlite3.Database;
  private dbPath: string;
  private isInitialized: boolean = false;

  private constructor(public name: string) {
    // Use environment variable for database path, defaulting to ./data
    const dataDir = process.env.VOS_DATA_PATH || path.join(process.cwd(), 'data');
    this.dbPath = path.join(dataDir, `${name}.db`);
    this.initializeDatabase();
  }

  /**
   * Initialize the storage singleton
   */
  public static initialize(name: string): SQLiteSessionStorage {
    if (!SQLiteSessionStorage.instances.has(name)) {
      SQLiteSessionStorage.instances.set(name, new SQLiteSessionStorage(name));
    }
    return SQLiteSessionStorage.instances.get(name)!;
  }

  /**
   * Get storage instance
   */
  public static getInstance(name: string): SQLiteSessionStorage {
    if (!SQLiteSessionStorage.instances.has(name)) {
      return SQLiteSessionStorage.initialize(name);
    }
    return SQLiteSessionStorage.instances.get(name)!;
  }

  /**
   * Initialize SQLite database and create tables
   */
  private initializeDatabase(): void {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error(`Error opening database ${this.dbPath}:`, err);
          return;
        }
        console.log(`Connected to SQLite database: ${this.dbPath}`);
      });

      // Create table if it doesn't exist
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS user_data (
            user_id TEXT PRIMARY KEY,
            credential_id TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create index for better performance
        this.db.run(`
          CREATE INDEX IF NOT EXISTS idx_user_data_credential_id 
          ON user_data(credential_id)
        `);

        this.isInitialized = true;
      });

    } catch (error) {
      console.error(`Error initializing database ${this.dbPath}:`, error);
      throw error;
    }
  }

  /**
   * Wait for database initialization
   */
  private async waitForInit(): Promise<void> {
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInit, 10);
    }
      };
      checkInit();
    });
  }

  /**
   * Set data for a user
   */
  public async set(userId: string, data: StoredData): Promise<void> {
    await this.waitForInit();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_data 
        (user_id, credential_id, address, updated_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run([userId, data.credentialId || null, data.address || null], function(err) {
        if (err) {
          console.error('Error storing user data:', err);
          reject(err);
        } else {
          resolve();
        }
      });

      stmt.finalize();
    });
  }

  /**
   * Get data for a user
   */
  public async get(userId: string): Promise<StoredData | undefined> {
    await this.waitForInit();
    
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT credential_id, address FROM user_data WHERE user_id = ?',
        [userId],
        (err, row: any) => {
          if (err) {
            console.error('Error retrieving user data:', err);
            reject(err);
          } else if (row) {
            resolve({
              credentialId: row.credential_id || undefined,
              address: row.address || undefined
            });
          } else {
            resolve(undefined);
          }
        }
      );
    });
  }

  /**
   * Delete data for a user
   */
  public async delete(userId: string): Promise<boolean> {
    await this.waitForInit();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM user_data WHERE user_id = ?',
        [userId],
        function(err) {
          if (err) {
            console.error('Error deleting user data:', err);
            reject(err);
          } else {
            resolve(this.changes > 0);
    }
        }
      );
    });
  }

  /**
   * Clear all data
   */
  public async clear(): Promise<void> {
    await this.waitForInit();
    
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM user_data', (err) => {
        if (err) {
          console.error('Error clearing user data:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get all user IDs
   */
  public async getAllUserIds(): Promise<string[]> {
    await this.waitForInit();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT user_id FROM user_data',
        [],
        (err, rows: any[]) => {
          if (err) {
            console.error('Error retrieving user IDs:', err);
            reject(err);
          } else {
            resolve(rows.map(row => row.user_id));
          }
        }
      );
    });
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database connection closed.');
          resolve();
        }
      });
    });
  }
}

// Backward compatibility - alias for the old class name
export const InMemorySessionStorage = SQLiteSessionStorage; 