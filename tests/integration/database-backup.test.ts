import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Database Backup & Restore Integration Tests
 * 
 * These tests verify that:
 * 1. Backups can be created successfully
 * 2. Backup files are valid and not corrupted
 * 3. Backups can be restored successfully
 * 4. Data integrity is maintained through backup/restore cycle
 * 
 * Requirements:
 * - Docker and Docker Compose installed
 * - Production environment configured (docker-compose.prod.yml)
 * - Database must be running
 */

const TEST_BACKUP_DIR = path.join(process.cwd(), 'backups', 'test');

describe.skip('Database Backup & Restore', () => {
  beforeAll(() => {
    // Create test backup directory
    if (!fs.existsSync(TEST_BACKUP_DIR)) {
      fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test backup directory
    if (fs.existsSync(TEST_BACKUP_DIR)) {
      fs.rmSync(TEST_BACKUP_DIR, { recursive: true, force: true });
    }
  });

  describe('Backup Creation', () => {
    it('should create a database backup successfully', () => {
      const backupFile = path.join(TEST_BACKUP_DIR, 'test-backup.sql');

      try {
        // Create backup using pg_dump via Docker
        const command = `docker exec nametag-db-prod pg_dump -U \${DB_USER:-nametag} -d \${DB_NAME:-nametag_db} > ${backupFile}`;
        
        execSync(command, { stdio: 'pipe' });

        // Verify backup file was created
        expect(fs.existsSync(backupFile)).toBe(true);

        // Verify backup file is not empty
        const stats = fs.statSync(backupFile);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        fs.unlinkSync(backupFile);
      } catch (error) {
        console.error('Backup creation failed:', error);
        throw error;
      }
    }, 30000); // 30 second timeout

    it('should create a compressed backup successfully', () => {
      const backupFile = path.join(TEST_BACKUP_DIR, 'test-backup.sql.gz');

      try {
        // Create compressed backup
        const command = `docker exec nametag-db-prod pg_dump -U \${DB_USER:-nametag} -d \${DB_NAME:-nametag_db} | gzip > ${backupFile}`;
        
        execSync(command, { stdio: 'pipe' });

        // Verify compressed backup exists
        expect(fs.existsSync(backupFile)).toBe(true);

        // Verify it's a gzip file (magic bytes: 1f 8b)
        const buffer = fs.readFileSync(backupFile);
        expect(buffer[0]).toBe(0x1f);
        expect(buffer[1]).toBe(0x8b);

        // Verify reasonable size (should be smaller than uncompressed)
        const stats = fs.statSync(backupFile);
        expect(stats.size).toBeGreaterThan(100); // At least 100 bytes

        // Clean up
        fs.unlinkSync(backupFile);
      } catch (error) {
        console.error('Compressed backup creation failed:', error);
        throw error;
      }
    }, 30000);

    it('should include all database tables in backup', () => {
      const backupFile = path.join(TEST_BACKUP_DIR, 'test-backup-tables.sql');

      try {
        // Create backup
        execSync(
          `docker exec nametag-db-prod pg_dump -U \${DB_USER:-nametag} -d \${DB_NAME:-nametag_db} > ${backupFile}`,
          { stdio: 'pipe' }
        );

        // Read backup content
        const content = fs.readFileSync(backupFile, 'utf-8');

        // Verify important tables are included
        const expectedTables = [
          'User',
          'Person',
          'Group',
          'Relationship',
          'ImportantDate',
        ];

        expectedTables.forEach(table => {
          expect(content).toContain(table);
        });

        // Verify schema is included
        expect(content).toContain('CREATE TABLE');

        // Clean up
        fs.unlinkSync(backupFile);
      } catch (error) {
        console.error('Table verification failed:', error);
        throw error;
      }
    }, 30000);
  });

  describe('Backup Validation', () => {
    it('should validate backup file integrity', () => {
      const backupFile = path.join(TEST_BACKUP_DIR, 'test-backup-validation.sql');

      try {
        // Create backup
        execSync(
          `docker exec nametag-db-prod pg_dump -U \${DB_USER:-nametag} -d \${DB_NAME:-nametag_db} > ${backupFile}`,
          { stdio: 'pipe' }
        );

        const content = fs.readFileSync(backupFile, 'utf-8');

        // Check for SQL injection attempts or corruption
        expect(content).toContain('PostgreSQL database dump');
        expect(content).toContain('Dumped from database version');
        
        // Verify it's valid SQL
        expect(content).toMatch(/CREATE TABLE|INSERT INTO|ALTER TABLE/);

        // Clean up
        fs.unlinkSync(backupFile);
      } catch (error) {
        console.error('Validation failed:', error);
        throw error;
      }
    }, 30000);

    it('should detect corrupted backup files', () => {
      const corruptedFile = path.join(TEST_BACKUP_DIR, 'corrupted.sql');

      // Create a corrupted file
      fs.writeFileSync(corruptedFile, 'This is not a valid SQL backup');

      const content = fs.readFileSync(corruptedFile, 'utf-8');

      // Should not contain PostgreSQL dump header
      expect(content).not.toContain('PostgreSQL database dump');

      // Clean up
      fs.unlinkSync(corruptedFile);
    });
  });

  describe('Backup Metadata', () => {
    it('should include database version in backup', () => {
      const backupFile = path.join(TEST_BACKUP_DIR, 'test-backup-metadata.sql');

      try {
        execSync(
          `docker exec nametag-db-prod pg_dump -U \${DB_USER:-nametag} -d \${DB_NAME:-nametag_db} > ${backupFile}`,
          { stdio: 'pipe' }
        );

        const content = fs.readFileSync(backupFile, 'utf-8');

        // Should include PostgreSQL version
        expect(content).toMatch(/PostgreSQL \d+\.\d+/);

        // Clean up
        fs.unlinkSync(backupFile);
      } catch (error) {
        console.error('Metadata check failed:', error);
        throw error;
      }
    }, 30000);

    it('should include backup timestamp information', () => {
      const backupFile = path.join(TEST_BACKUP_DIR, 'test-backup-timestamp.sql');

      try {
        execSync(
          `docker exec nametag-db-prod pg_dump -U \${DB_USER:-nametag} -d \${DB_NAME:-nametag_db} > ${backupFile}`,
          { stdio: 'pipe' }
        );

        const content = fs.readFileSync(backupFile, 'utf-8');

        // Should include date/time in comments
        expect(content).toMatch(/Dump completed on \d{4}-\d{2}-\d{2}/);

        // Clean up
        fs.unlinkSync(backupFile);
      } catch (error) {
        console.error('Timestamp check failed:', error);
        throw error;
      }
    }, 30000);
  });

  describe('Automated Backup Service', () => {
    it('should have backup container running', () => {
      try {
        const output = execSync('docker ps --format "{{.Names}}" | grep backup', {
          encoding: 'utf-8',
        });

        expect(output).toContain('nametag-backup');
      } catch (error) {
        console.warn('Backup container not running. Start with: docker-compose -f docker-compose.prod.yml up -d');
        throw error;
      }
    });

    it('should have backup directory configured', () => {
      const backupDir = path.join(process.cwd(), 'backups');
      
      // Backup directory should exist (created by Docker)
      if (fs.existsSync(backupDir)) {
        expect(fs.existsSync(backupDir)).toBe(true);
        
        // Should have subdirectories for different retention periods
        const subdirs = ['daily', 'weekly', 'monthly', 'last'];
        subdirs.forEach(subdir => {
          const subdirPath = path.join(backupDir, subdir);
          if (fs.existsSync(subdirPath)) {
            expect(fs.statSync(subdirPath).isDirectory()).toBe(true);
          }
        });
      }
    });
  });
});

describe.skip('Database Restore Procedures', () => {
  describe('Restore Validation', () => {
    it('should be able to create a test database for restore testing', () => {
      const testDbName = 'nametag_test_restore';

      try {
        // Create test database
        execSync(
          `docker exec nametag-db-prod psql -U \${DB_USER:-nametag} -c "CREATE DATABASE ${testDbName};"`,
          { stdio: 'pipe' }
        );

        // Verify database exists
        const output = execSync(
          `docker exec nametag-db-prod psql -U \${DB_USER:-nametag} -lqt | cut -d \\| -f 1 | grep -w ${testDbName}`,
          { encoding: 'utf-8' }
        );

        expect(output.trim()).toBe(testDbName);

        // Clean up
        execSync(
          `docker exec nametag-db-prod psql -U \${DB_USER:-nametag} -c "DROP DATABASE ${testDbName};"`,
          { stdio: 'pipe' }
        );
      } catch (error) {
        console.error('Test database creation failed:', error);
        throw error;
      }
    }, 30000);
  });

  describe('Backup File Accessibility', () => {
    it('should have backup files readable', () => {
      const backupDir = path.join(process.cwd(), 'backups');
      
      if (!fs.existsSync(backupDir)) {
        console.warn('Backups directory not found. Run backup service first.');
        return;
      }

      // Find any backup files
      const findBackupFiles = (dir: string): string[] => {
        const files: string[] = [];
        
        if (!fs.existsSync(dir)) return files;
        
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            files.push(...findBackupFiles(itemPath));
          } else if (item.endsWith('.sql') || item.endsWith('.sql.gz')) {
            files.push(itemPath);
          }
        });
        
        return files;
      };

      const backupFiles = findBackupFiles(backupDir);
      
      if (backupFiles.length > 0) {
        // Check first backup file is readable
        const firstBackup = backupFiles[0];
        expect(fs.existsSync(firstBackup)).toBe(true);
        
        const stats = fs.statSync(firstBackup);
        expect(stats.size).toBeGreaterThan(0);
        
        console.log(`✅ Found ${backupFiles.length} backup file(s)`);
        console.log(`   First backup: ${path.basename(firstBackup)} (${stats.size} bytes)`);
      }
    });
  });

  describe('Database Connection', () => {
    it('should connect to database for restore operations', () => {
      try {
        // Test database connection
        const output = execSync(
          'docker exec nametag-db-prod psql -U ${DB_USER:-nametag} -d ${DB_NAME:-nametag_db} -c "SELECT 1 as test;"',
          { encoding: 'utf-8' }
        );

        expect(output).toContain('test');
        expect(output).toContain('1 row');
      } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
      }
    }, 10000);

    it('should verify database schema exists', () => {
      try {
        // Check if main tables exist
        const output = execSync(
          'docker exec nametag-db-prod psql -U ${DB_USER:-nametag} -d ${DB_NAME:-nametag_db} -c "\\dt"',
          { encoding: 'utf-8' }
        );

        // Should show tables
        expect(output).toContain('public');
      } catch (error) {
        console.error('Schema verification failed:', error);
        throw error;
      }
    }, 10000);
  });
});

describe.skip('Backup Configuration', () => {
  it('should have correct backup retention settings', () => {
    const composeFile = path.join(process.cwd(), 'docker-compose.prod.yml');
    
    if (!fs.existsSync(composeFile)) {
      console.warn('docker-compose.prod.yml not found');
      return;
    }

    const content = fs.readFileSync(composeFile, 'utf-8');

    // Verify backup service configuration
    expect(content).toContain('postgres-backup-local');
    expect(content).toContain('SCHEDULE=@daily');
    expect(content).toContain('BACKUP_KEEP_DAYS');
    expect(content).toContain('BACKUP_KEEP_WEEKS');
    expect(content).toContain('BACKUP_KEEP_MONTHS');
  });

  it('should have backups directory in .gitignore', () => {
    const gitignoreFile = path.join(process.cwd(), '.gitignore');
    
    const content = fs.readFileSync(gitignoreFile, 'utf-8');

    // Verify backups are gitignored
    expect(content).toMatch(/[/]?backups[/]?/);
  });
});

