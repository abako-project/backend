import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SDK } from '@virtonetwork/sdk';


describe('Projects Module E2E Tests', () => {
  let app: INestApplication;
  let sdk: SDK;
  let authToken: string;
  let userId: string;
  let userAccountId: string;
  let contractAddress: string;
  let workerAccountId: string;
  let calendarContractAddress: string = ''; // Please replace with the actual calendar contract address

  beforeAll(async () => {
    console.log('Starting Projects E2E tests...');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Initialize client SDK
    sdk = new SDK({
      federate_server: 'http://localhost:3000/api',
      provider_url: 'ws://localhost:21000',
    });

    // Generate a unique user ID for this test run
    userId = `test-projects-user-${Date.now()}@example.com`;

    console.log('Application started successfully');
    console.log('Client SDK initialized');
    console.log(`Test user: ${userId}`);
  });

  afterAll(async () => {
    console.log('Closing application...');
    await app.close();
  });

  describe('Complete flow: Auth + Projects', () => {
    describe('Authentication - Registration and Connection', () => {
      it('should register a new user', async () => {
        console.log('Registering new user...');

        const userData = {
          profile: {
            id: userId,
            name: 'Projects Test User',
          }
        };

        const preparedData = await sdk.auth.prepareRegistration(userData);

        userAccountId = preparedData.passAccountAddress;
        workerAccountId = preparedData.passAccountAddress;

        const response = await request(app.getHttpServer())
          .post('/auth/custom-register')
          .send(preparedData);

        console.log('User registered:', response.body.success);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.body).toHaveProperty('success', true);
      });

      it('should connect user and obtain token', async () => {
        console.log('Connecting user and obtaining token...');

        const preparedConnection = await sdk.auth.prepareConnection(userId);
        console.log('Connection data prepared');

        const response = await request(app.getHttpServer())
          .post('/auth/custom-connect')
          .send({ userId });

        console.log(`Connection status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.body, null, 2));

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = response.body;

        console.log("result", result);

        console.log('Connection completed successfully on the server:', 'success');
        console.log(JSON.stringify(result, null, 2));
        // The user signs the transaction that starts the session on the server
        const resultCustom = await sdk.auth.sign(result.extrinsic);
        console.log("resultCustom", resultCustom);

        expect([200, 201]).toContain(response.status);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('extrinsic');

        authToken = response.body.token;

        console.log(`Token received: ${authToken.substring(0, 20)}...`);
        console.log(`User Account ID: ${userAccountId}`);
      });
    });

    describe('Deploy Calendar Contract', () => {
      it('should deploy a new calendar contract', async () => {
        console.log('Deploying calendar contract...');

        expect(authToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post('/calendar/deploy/v5')
          .set('Authorization', `Bearer ${authToken}`);

        console.log('Deploy response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('address');

        calendarContractAddress = response.body.address;

        console.log(`Contract deployed successfully at: ${calendarContractAddress}`);
      });
    });

    describe('Calendar - Worker Registration', () => {
      it('should register a worker in the calendar', async () => {
        console.log('Registering worker in calendar...');
        console.log(`Contract: ${calendarContractAddress}`);
        console.log(`Worker: ${workerAccountId}`);

        expect(authToken).toBeDefined();
        expect(calendarContractAddress).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${calendarContractAddress}/register_worker`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ worker: workerAccountId });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('Worker registered successfully');
      });
    });

    describe('Calendar - Admin Operations', () => {
      it('should set 40 hours availability for main worker as admin', async () => {
        console.log('Admin setting 40 hours for main worker...');

        expect(authToken).toBeDefined();
        expect(workerAccountId).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${calendarContractAddress}/admin_set_worker_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            worker: workerAccountId,
            availability: { type: "WeeklyHours", value: 40 }
          });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('40 hours availability set by admin for main worker');
      });

      it('should register multiple additional workers at once', async () => {
        console.log('Registering multiple additional workers...');

        expect(authToken).toBeDefined();

        const workers = [
          '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
        ];

        const response = await request(app.getHttpServer())
          .post(`/calendar/${calendarContractAddress}/register_workers`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ workers });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('Multiple additional workers registered successfully');
      });

      it('should set 30 hours availability for first additional worker', async () => {
        console.log('Admin setting 30 hours for additional worker 1...');

        expect(authToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${calendarContractAddress}/admin_set_worker_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            worker: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
            availability: { type: "WeeklyHours", value: 30 }
          });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('30 hours availability set by admin');
      });

      it('should set 20 hours availability for second additional worker', async () => {
        console.log('Admin setting 20 hours for additional worker 2...');

        expect(authToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post(`/calendar/${calendarContractAddress}/admin_set_worker_availability`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            worker: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
            availability: { type: "WeeklyHours", value: 20 }
          });

        console.log('Response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        console.log('20 hours availability set by admin');
      });
    });

    describe('Projects Module - Deploy Contract', () => {
      it('should deploy a new project contract', async () => {
        console.log('Deploying project contract...');

        const deployData = {
          name: 'Test Project E2E',
          dao_address: userAccountId,
          calendar_contract: calendarContractAddress,
        };

        expect(authToken).toBeDefined();
        expect(userAccountId).toBeDefined();

        const response = await request(app.getHttpServer())
          .post('/projects/deploy/v5')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployData)
          .expect(201);

        console.log('Deploy response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('address');

        contractAddress = response.body.address;
        console.log(`Contract deployed successfully at: ${contractAddress}`);
      });
    });

     describe('Projects Module - Assign Coordinator', () => {
       it('should assign coordinator to project', async () => {
         console.log('Assigning coordinator to project...');
 
         expect(authToken).toBeDefined();
         expect(contractAddress).toBeDefined();
 
         const response = await request(app.getHttpServer())
           .post(`/projects/${contractAddress}/assign_coordinator`)
           .set('Authorization', `Bearer ${authToken}`)
           .expect(200);
 
         console.log('Response:', JSON.stringify(response.body, null, 2));
 
         expect(response.body).toHaveProperty('success');
         console.log('Coordinator assigned successfully');
       });
     });

     describe('Projects Module - Assign Team', () => {
       it('should assign a team to the project', async () => {
         console.log('Assigning team to project...');
         
         expect(authToken).toBeDefined();
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .post(`/projects/${contractAddress}/assign_team`)
           .set('Authorization', `Bearer ${authToken}`)
           .send({ideal_team_size: 1})
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toHaveProperty('success');
         console.log('Team assigned successfully');
       });
     });

     describe('Projects Module - Propose Scope', () => {
       it('should propose a scope with tasks', async () => {
         console.log('Proposing scope with tasks...');
         
         const scopeData = {
           tasks: [
             [1, { type: 'Days', value: 5 }, '1000000000000', []],
             [2, { type: 'Weeks', value: 2 }, '2000000000000', [1]],
             [3, { type: 'Days', value: 3 }, '1500000000000', [1]],
           ],
           advance_payment_percentage: 30,
           document_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
         };

         expect(authToken).toBeDefined();
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .post(`/projects/${contractAddress}/propose_scope`)
           .set('Authorization', `Bearer ${authToken}`)
           .send(scopeData)
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toHaveProperty('success');
         console.log('Scope proposed successfully');
       });
     });

     describe('Projects Module - Approve Scope', () => {
       it('should approve scope tasks', async () => {
         console.log('Approving scope tasks...');
         
         expect(authToken).toBeDefined();
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .post(`/projects/${contractAddress}/approve_scope`)
           .set('Authorization', `Bearer ${authToken}`)
           .send({ approved_task_ids: [1, 2, 3] })
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toHaveProperty('success');
         console.log('Scope tasks approved successfully');
       });
     });

     describe('Projects Module - Queries', () => {
       it('should get project information', async () => {
         console.log('Getting project information...');
         
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .get(`/projects/${contractAddress}/get_project_info`)
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toBeDefined();
         expect(response.body).toHaveProperty('success', true);
         expect(response.body).toHaveProperty('response');
         console.log('Project information obtained successfully');
       });

       it('should get all tasks', async () => {
         console.log('Getting all tasks...');
         
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .get(`/projects/${contractAddress}/get_all_tasks`)
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toBeDefined();
         expect(response.body).toHaveProperty('success', true);
         expect(response.body).toHaveProperty('response');
         expect(Array.isArray(response.body.response)).toBe(true);
         expect(response.body.response.length).toBeGreaterThanOrEqual(3);
         console.log(`All tasks obtained: ${response.body.response.length} tasks`);
       });

       it('should get specific task information (task 1)', async () => {
         console.log('Getting specific task information for task 1...');
         
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .get(`/projects/${contractAddress}/get_task?task_id=1`)
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toBeDefined();
         expect(response.body).toHaveProperty('success', true);
         expect(response.body).toHaveProperty('response');
         console.log('Task information obtained successfully');
       });

       it('should get project status', async () => {
         console.log('Getting project status...');
         
         expect(contractAddress).toBeDefined();

         const response = await request(app.getHttpServer())
           .get(`/projects/${contractAddress}/get_project_status`)
           .expect(200);

         console.log('Response:', JSON.stringify(response.body, null, 2));

         expect(response.body).toBeDefined();
         expect(response.body).toHaveProperty('success', true);
         expect(response.body).toHaveProperty('response');
         console.log('Project status obtained successfully');
       });
     });
   });
 });