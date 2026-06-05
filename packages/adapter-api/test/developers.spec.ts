import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Integration tests for Developers Module
 * 
 * These tests will:
 * 1. Test all CRUD operations for developers
 * 2. Test image upload and retrieval
 * 3. Test relationships (projects, milestones)
 * 
 * Requirements:
 * - A running MongoDB instance
 * - The API server should be configured properly
 */

describe('Developers Module E2E Tests', () => {
  let app: INestApplication;
  let developerId: number;

  beforeAll(async () => {
    console.log('🚀 Starting Developers E2E Tests');
    console.log('='.repeat(80));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    
    await app.init();

    console.log('Application started successfully');
  });

  afterAll(async () => {
    console.info('='.repeat(80) + '\n');
    await app.close();
  });

  describe('Developer CRUD Operations', () => {
    it('should create a new developer profile', async () => {
      console.log('Creating developer profile...');

      const developerData = {
        userId: `dev-${Date.now()}`,
        name: 'John Developer',
        githubUsername: 'johndeveloper',
        portfolioUrl: 'https://johndeveloper.dev',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/developers')
        .send(developerData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('developerId');
      expect(response.body.message).toBe('Developer profile created successfully');

      developerId = response.body.developerId;
      console.log(`✅ Created developer with ID: ${developerId}`);
    });

    it('should get all developers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/developers')
        .expect(200);

      expect(response.body).toHaveProperty('developers');
      expect(Array.isArray(response.body.developers)).toBe(true);
      expect(response.body.developers.length).toBeGreaterThan(0);
      
      console.log(`✅ Retrieved ${response.body.developers.length} developer(s)`);
    });

    it('should get a specific developer by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/developers/${developerId}`)
        .expect(200);

      expect(response.body).toHaveProperty('developer');
      expect(response.body.developer).toHaveProperty('id', developerId);
      expect(response.body.developer).toHaveProperty('userId');
      expect(response.body.developer).toHaveProperty('name');
      expect(response.body.developer).toHaveProperty('email');
      expect(response.body.developer).toHaveProperty('githubUsername');
      expect(response.body.developer).toHaveProperty('consultantProjects');
      
      console.log(`✅ Retrieved developer ${developerId}`);
    });

    it('should update developer profile', async () => {
      const updateData = {
        name: 'John Developer Updated',
        email: `dev-updated-${Date.now()}@example.com`,
        githubUsername: 'johndeveloper',
        portfolioUrl: 'https://johndeveloper-updated.dev',
        bio: 'Experienced full-stack developer with 5 years of experience',
        background: 'Worked at multiple tech companies',
        role: 'senior',
        location: 'San Francisco, USA',
        availability: 'FullTime',
        languages: ['1', '2'],
        skills: ['1', '2', '3'],
        availableHoursPerWeek: 40,
      };

      const response = await request(app.getHttpServer())
        .put(`/v1/developers/${developerId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('developerId', developerId);
      expect(response.body.message).toBe('Developer updated successfully');

      // Verify the update
      const getResponse = await request(app.getHttpServer())
        .get(`/v1/developers/${developerId}`)
        .expect(200);

      expect(getResponse.body.developer.name).toBe(updateData.name);
      expect(getResponse.body.developer.bio).toBe(updateData.bio);
      expect(getResponse.body.developer.role).toBe(updateData.role);
      expect(getResponse.body.developer.availability).toBe(updateData.availability);
      
      console.log(`✅ Updated developer ${developerId}`);
    });

    it('should return 404 for non-existent developer', async () => {
      const nonExistentId = 99999;
      const response = await request(app.getHttpServer())
        .get(`/v1/developers/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
      
      console.log('✅ Correctly returned 404 for non-existent developer');
    });
  });

  describe('Developer Image Operations', () => {
    it('should upload developer profile image', async () => {
      // Create a simple test image buffer (1x1 PNG)
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAACxklEQVR4nOzTsQ3AIBDAwChCYmsqBmeML3w3gRuvfc8HVf90AEwyAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSXgAAAP//Zt4DDF/qY/EAAAAASUVORK5CYII=',
        'base64'
      );

      const response = await request(app.getHttpServer())
        .put(`/v1/developers/${developerId}`)
        .attach('image', testImageBuffer, 'test.png')
        .field('name', 'John Developer Updated')
        .field('email', `dev-updated-${Date.now()}@example.com`)
        .field('githubUsername', 'johndeveloper')
        .field('bio', 'Test bio')
        .field('background', 'Test background')
        .field('role', 'senior')
        .field('location', 'San Francisco')
        .field('availability', 'FullTime')
        .field('languages', ['1', '2'])
        .field('skills', ['1', '2'])
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Developer updated successfully');
      
      console.log('✅ Uploaded developer profile image');
    });

    it('should retrieve developer profile image', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/developers/${developerId}/attachment`)
        .expect(200);

      expect(response.headers['content-type']).toBeDefined();
      expect(Buffer.isBuffer(response.body) || typeof response.body === 'string').toBe(true);
      
      console.log('✅ Retrieved developer profile image');
    });

    it('should return 404 for developer without image', async () => {
      // Create a new developer without image
      const newDeveloperData = {
        userId: `dev-no-image-${Date.now()}`,
        name: 'Developer No Image',
        githubUsername: 'devnoimage',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/v1/developers')
        .send(newDeveloperData)
        .expect(201);

      const newDeveloperId = createResponse.body.developerId;

      const response = await request(app.getHttpServer())
        .get(`/v1/developers/${newDeveloperId}/attachment`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      
      console.log('✅ Correctly returned 404 for developer without image');
    });
  });

  describe('Developer Relationships', () => {
    it('should get developer projects', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/developers/${developerId}/projects`)
        .expect(200);

      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
      
      console.log(`✅ Retrieved ${response.body.projects.length} project(s) for developer`);
    });

    it('should get developer milestones', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/developers/${developerId}/milestones`)
        .expect(200);

      expect(response.body).toHaveProperty('milestones');
      expect(Array.isArray(response.body.milestones)).toBe(true);
      
      console.log(`✅ Retrieved ${response.body.milestones.length} milestone(s) for developer`);
    });
  });

  describe('Developer Validation', () => {
    it('should create developer with legacy email-only identifier', async () => {
      const legacyData = {
        email: `legacy-dev-${Date.now()}@example.com`,
        name: 'Legacy Developer',
        githubUsername: `legacydev${Date.now()}`,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/v1/developers')
        .send(legacyData)
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get(`/v1/developers/${createResponse.body.developerId}`)
        .expect(200);

      expect(getResponse.body.developer).toHaveProperty('userId', legacyData.email);
      expect(getResponse.body.developer).toHaveProperty('email', legacyData.email);
    });

    it('should fail to create developer with missing required fields', async () => {
      const invalidData = {
        name: 'Incomplete Developer',
        // Missing userId/email and githubUsername
      };

      const response = await request(app.getHttpServer())
        .post('/v1/developers')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      
      console.log('✅ Correctly rejected developer with missing required fields');
    });

    it('should fail to update non-existent developer', async () => {
      const nonExistentId = 99999;
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        githubUsername: 'updated',
        bio: 'Test bio',
        background: 'Test background',
        role: 'senior',
        location: 'Test',
        availability: 'FullTime',
        languages: ['1'],
        skills: ['1'],
      };

      const response = await request(app.getHttpServer())
        .put(`/v1/developers/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      
      console.log('✅ Correctly returned 404 when updating non-existent developer');
    });
  });
});
