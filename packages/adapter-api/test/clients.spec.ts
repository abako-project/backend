import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Integration tests for Clients Module
 * 
 * These tests will:
 * 1. Test all CRUD operations for clients
 * 2. Test image upload and retrieval
 * 3. Test relationships (projects)
 * 
 * Requirements:
 * - A running MongoDB instance
 * - The API server should be configured properly
 */

describe('Clients Module E2E Tests', () => {
  let app: INestApplication;
  let clientId: number;

  beforeAll(async () => {
    console.log('🚀 Starting Clients E2E Tests');
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

  describe('Client CRUD Operations', () => {
    it('should create a new client profile', async () => {
      console.log('Creating client profile...');

      const clientData = {
        userId: `client-${Date.now()}`,
        name: 'John Client',
        company: 'Acme Corporation',
        department: 'Engineering',
        website: 'https://acme.com',
        description: 'Leading technology company specializing in software solutions',
        location: 'San Francisco, USA',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/clients')
        .send(clientData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('clientId');
      expect(response.body.message).toBe('Client profile created successfully');

      clientId = response.body.clientId;
      console.log(`✅ Created client with ID: ${clientId}`);
    });

    it('should get all clients', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/clients')
        .expect(200);

      expect(response.body).toHaveProperty('clients');
      expect(Array.isArray(response.body.clients)).toBe(true);
      expect(response.body.clients.length).toBeGreaterThan(0);
      
      console.log(`✅ Retrieved ${response.body.clients.length} client(s)`);
    });

    it('should get a specific client by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}`)
        .expect(200);

      expect(response.body).toHaveProperty('client');
      expect(response.body.client).toHaveProperty('id', clientId);
      expect(response.body.client).toHaveProperty('userId');
      expect(response.body.client).toHaveProperty('name');
      expect(response.body.client).toHaveProperty('email');
      expect(response.body.client).toHaveProperty('company');
      expect(response.body.client).toHaveProperty('department');
      expect(response.body.client).toHaveProperty('website');
      expect(response.body.client).toHaveProperty('description');
      expect(response.body.client).toHaveProperty('location');
      expect(response.body.client).toHaveProperty('projects');
      
      console.log(`✅ Retrieved client ${clientId}`);
    });

    it('should update client profile', async () => {
      const updateData = {
        name: 'John Client Updated',
        email: `client-updated-${Date.now()}@example.com`,
        company: 'Acme Corporation Updated',
        department: 'Product Development',
        website: 'https://acme-updated.com',
        description: 'Updated description for leading technology company',
        location: 'New York, USA',
      };

      const response = await request(app.getHttpServer())
        .put(`/v1/clients/${clientId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('clientId', clientId);
      expect(response.body.message).toBe('Client updated successfully');

      // Verify the update
      const getResponse = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}`)
        .expect(200);

      expect(getResponse.body.client.name).toBe(updateData.name);
      expect(getResponse.body.client.company).toBe(updateData.company);
      expect(getResponse.body.client.department).toBe(updateData.department);
      expect(getResponse.body.client.location).toBe(updateData.location);
      
      console.log(`✅ Updated client ${clientId}`);
    });

    it('should return 404 for non-existent client', async () => {
      const nonExistentId = 99999;
      const response = await request(app.getHttpServer())
        .get(`/v1/clients/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
      
      console.log('✅ Correctly returned 404 for non-existent client');
    });
  });

  describe('Client Image Operations', () => {
    it('should upload client profile image', async () => {
      // Create a simple test image buffer (1x1 PNG)
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAACxklEQVR4nOzTsQ3AIBDAwChCYmsqBmeML3w3gRuvfc8HVf90AEwyAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSDECaAUgzAGkGIM0ApBmANAOQZgDSXgAAAP//Zt4DDF/qY/EAAAAASUVORK5CYII=',
        'base64'
      );

      const response = await request(app.getHttpServer())
        .put(`/v1/clients/${clientId}`)
        .attach('image', testImageBuffer, 'test.png')
        .field('name', 'John Client Updated')
        .field('email', `client-updated-${Date.now()}@example.com`)
        .field('company', 'Acme Corp')
        .field('department', 'Engineering')
        .field('website', 'https://acme.com')
        .field('description', 'Test description')
        .field('location', 'San Francisco')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Client updated successfully');
      
      console.log('✅ Uploaded client profile image');
    });

    it('should retrieve client profile image', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/attachment`)
        .expect(200);

      expect(response.headers['content-type']).toBeDefined();
      expect(Buffer.isBuffer(response.body) || typeof response.body === 'string').toBe(true);
      
      console.log('✅ Retrieved client profile image');
    });

    it('should return 404 for client without image', async () => {
      // Create a new client without image
      const newClientData = {
        userId: `client-no-image-${Date.now()}`,
        name: 'Client No Image',
        company: 'Test Company',
        department: 'Test Department',
        website: 'https://test.com',
        description: 'Test description',
        location: 'Test Location',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/v1/clients')
        .send(newClientData)
        .expect(201);

      const newClientId = createResponse.body.clientId;

      const response = await request(app.getHttpServer())
        .get(`/v1/clients/${newClientId}/attachment`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      
      console.log('✅ Correctly returned 404 for client without image');
    });
  });

  describe('Client Relationships', () => {
    it('should get client projects', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/clients/${clientId}/projects`)
        .expect(200);

      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
      
      console.log(`✅ Retrieved ${response.body.projects.length} project(s) for client`);
    });
  });

  describe('Client Validation', () => {
    it('should create client with legacy email-only identifier', async () => {
      const legacyData = {
        email: `legacy-client-${Date.now()}@example.com`,
        name: 'Legacy Client',
        company: 'Legacy Company',
        department: 'Test Department',
        website: 'https://legacy.example.com',
        description: 'Legacy email-only profile',
        location: 'Test Location',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/clients')
        .send(legacyData)
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get(`/v1/clients/${response.body.clientId}`)
        .expect(200);

      expect(getResponse.body.client).toHaveProperty('userId', legacyData.email);
      expect(getResponse.body.client).toHaveProperty('email', legacyData.email);
    });

    it('should fail to create client with missing required fields', async () => {
      const invalidData = {
        name: 'Incomplete Client',
        company: 'Test Company',
        // Missing userId/email, department, website, description, and location
      };

      const response = await request(app.getHttpServer())
        .post('/v1/clients')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      
      console.log('✅ Correctly rejected client with missing required fields');
    });

    it('should fail to update non-existent client', async () => {
      const nonExistentId = 99999;
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        company: 'Updated Company',
        department: 'Updated Department',
        website: 'https://updated.com',
        description: 'Updated description',
        location: 'Updated Location',
      };

      const response = await request(app.getHttpServer())
        .put(`/v1/clients/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      
      console.log('✅ Correctly returned 404 when updating non-existent client');
    });
  });
});
