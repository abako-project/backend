import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SDK } from '@virtonetwork/sdk';
import { encodeAddress } from '@polkadot/util-crypto';
import { CreateProposalRequest } from '../src/modules/projects/types';


describe('Projects Module E2E Tests', () => {
  let app: INestApplication;
  let sdk: SDK;
  let authTokenClient: string;
  let authTokenWorkerOne: string;
  let authTokenWorkerTwo: string;
  let authTokenWorkerThree: string;
  let clientUserId: string;
  let workerOneUserId: string;
  let workerTwoUserId: string;
  let workerThreeUserId: string;
  let clientAccountId: string;
  let clientId: number;
  let workerOneAccountId: string;
  let workerTwoAccountId: string;
  let workerThreeAccountId: string;
  let projectId: string;
  let contractAddress: string;
  let rejectedProjectId: string;
  let rejectedContractAddress: string;
  let coordinatorAccountId: string;
  let coordinatorAuthToken: string;
  let rejectedCoordinatorAccountId: string;
  let rejectedCoordinatorAuthToken: string;
  let calendarContractAddress: string;
  let ratingsContractAddress: string;

  beforeAll(async () => {
    console.info('🚀 Starting PolkaTalent Workflow E2E Tests');
    console.info('='.repeat(80));

    console.info('   The PolkaTalent DAO with governance rules is already configured in the genesis block of the test blockchain.');

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
    const timestamp = Date.now();
    clientUserId = `test-projects-user-${timestamp}@example.com`;
    workerOneUserId = `test-projects-worker1-${timestamp}@example.com`;
    // workerTwoUserId = `test-projects-worker2-${timestamp}@example.com`;
    // workerThreeUserId = `test-projects-worker3-${timestamp}@example.com`;

    console.log('Application started successfully');
    console.log('Client SDK initialized');
    console.log(`Test client: ${clientUserId}`);
    console.log(`Test worker 1: ${workerOneUserId}`);
    // console.log(`Test worker 2: ${workerTwoUserId}`);
    // console.log(`Test worker 3: ${workerThreeUserId}`);
  });

  afterAll(async () => {
    console.info('='.repeat(80) + '\n');
    await app.close();
  });

  describe('Complete Workflow: PolkaTalent Platform', () => {
    describe('Deploy Ratings Contract for Test Isolation', () => {
      it('should deploy ratings contract for E2E test', async () => {
        console.log('Deploying isolated ratings contract for E2E test...');

        // Call directly to contracts-api signing service
        const signingServiceUrl = 'http://localhost:3010';
        const deployUrl = `${signingServiceUrl}/ratings/deploy/v5`;

        const deployResponse = await fetch(deployUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });

        expect(deployResponse.ok).toBe(true);
        const deployResult = await deployResponse.json() as { success: boolean, address: string };

        console.log('Ratings deploy response:', JSON.stringify(deployResult, null, 2));

        expect(deployResult).toHaveProperty('success', true);
        expect(deployResult).toHaveProperty('address');

        ratingsContractAddress = deployResult.address;

        console.info(`✅ Deployed test-isolated ratings contract at: ${ratingsContractAddress.substring(0, 20)}...`);
      });

      it('should deploy calendar contract for E2E test', async () => {
        console.log('Deploying isolated calendar contract for E2E test...');

        // Call directly to contracts-api signing service
        const signingServiceUrl = 'http://localhost:3010';
        const deployUrl = `${signingServiceUrl}/calendar/deploy/v5`;

        const deployResponse = await fetch(deployUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ratings_contract: ratingsContractAddress })
        });

        expect(deployResponse.ok).toBe(true);
        const deployResult = await deployResponse.json() as { success: boolean, address: string };

        console.log('Calendar deploy response:', JSON.stringify(deployResult, null, 2));

        expect(deployResult).toHaveProperty('success', true);
        expect(deployResult).toHaveProperty('address');

        calendarContractAddress = deployResult.address;

        console.info(`✅ Deployed test-isolated calendar contract at: ${calendarContractAddress.substring(0, 20)}...`);
      });
    });
    describe('🎫 Pass Pallet: Accountless Authentication & Role-based Access', () => {
      it('should register a new user', async () => {
        console.log('Registering new user...');

        const userData = {
          profile: {
            id: clientUserId,
            name: 'Projects Test Client User',
          }
        };

        const preparedData = await sdk.auth.prepareRegistration(userData);

        clientAccountId = preparedData.passAccountAddress;

        const response = await request(app.getHttpServer())
          .post('/auth/custom-register')
          .send(preparedData);

        console.log('User registered:', response.body.success);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.body).toHaveProperty('success', true);

        console.info(`✅ Registered new user: ${clientUserId.substring(0, 20)}...`);
      });

      it('should register the new user as a client', async () => {
        console.log('Registering user as client...');
        console.log(`Client email: ${clientUserId}`);
        console.log(`Client account ID: ${clientAccountId}`);

        const clientData = {
          email: clientUserId,
          name: 'Projects Test Client User',
          company: 'Test Company',
          department: 'Engineering',
          website: 'https://testcompany.com',
          description: 'Test company for projects E2E tests',
          location: 'Test Location',
        };

        const response = await request(app.getHttpServer())
          .post('/clients')
          .send(clientData)
          .expect(201);

        console.log('Client registration response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('clientId');
        expect(response.body.message).toBe('Client profile created successfully');

        clientId = response.body.clientId;
        console.info(`✅ Registered user as client with ID: ${clientId}`);
      });

      it('should register worker one', async () => {
        console.log('Registering worker one...');

        const userData = {
          profile: {
            id: workerOneUserId,
            name: 'Projects Test Worker One',
          }
        };

        const preparedData = await sdk.auth.prepareRegistration(userData);

        workerOneAccountId = preparedData.passAccountAddress;

        const response = await request(app.getHttpServer())
          .post('/auth/custom-register')
          .send(preparedData);

        console.log('Worker one registered:', response.body.success);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.body).toHaveProperty('success', true);

        console.info(`✅ Registered worker one: ${workerOneUserId.substring(0, 20)}...`);
      });

      it('should register the worker as a developer', async () => {
        console.log('Registering worker as developer...');
        console.log(`Developer email: ${workerOneUserId}`);
        console.log(`Worker account ID: ${workerOneAccountId}`);

        const developerData = {
          email: workerOneUserId,
          name: 'Projects Test Worker One',
          githubUsername: 'testworkerone',
          portfolioUrl: 'https://testworkerone.dev',
        };

        const response = await request(app.getHttpServer())
          .post('/developers')
          .send(developerData)
          .expect(201);

        console.log('Developer registration response:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('developerId');
        expect(response.body.message).toBe('Developer profile created successfully');

        console.info(`✅ Registered worker as developer with ID: ${response.body.developerId}`);
      });

      // it('should register worker two', async () => {
      //   console.log('Registering worker two...');

      //   const userData = {
      //     profile: {
      //       id: workerTwoUserId,
      //       name: 'Projects Test Worker Two',
      //     }
      //   };

      //   const preparedData = await sdk.auth.prepareRegistration(userData);

      //   workerTwoAccountId = preparedData.passAccountAddress;

      //   const response = await request(app.getHttpServer())
      //     .post('/auth/custom-register')
      //     .send(preparedData);

      //   console.log('Worker two registered:', response.body.success);
      //   expect(response.status).toBeGreaterThanOrEqual(200);
      //   expect(response.status).toBeLessThan(300);
      //   expect(response.body).toHaveProperty('success', true);

      //   console.info(`✅ Registered worker two: ${workerTwoUserId.substring(0, 20)}...`);
      // });

      // it('should register worker three', async () => {
      //   console.log('Registering worker three...');

      //   const userData = {
      //     profile: {
      //       id: workerThreeUserId,
      //       name: 'Projects Test Worker Three',
      //     }
      //   };

      //   const preparedData = await sdk.auth.prepareRegistration(userData);

      //   workerThreeAccountId = preparedData.passAccountAddress;

      //   const response = await request(app.getHttpServer())
      //     .post('/auth/custom-register')
      //     .send(preparedData);

      //   console.log('Worker three registered:', response.body.success);
      //   expect(response.status).toBeGreaterThanOrEqual(200);
      //   expect(response.status).toBeLessThan(300);
      //   expect(response.body).toHaveProperty('success', true);

      //   console.info(`✅ Registered worker three: ${workerThreeUserId.substring(0, 20)}...`);
      // });

      // it('should register the worker three as a developer', async () => {
      //   console.log('Registering worker as developer...');
      //   console.log(`Developer email: ${workerThreeUserId}`);
      //   console.log(`Worker account ID: ${workerThreeAccountId}`);

      //   const developerData = {
      //     email: workerThreeUserId,
      //     name: 'Projects Test Worker Three',
      //     githubUsername: 'testworkerthree',
      //     portfolioUrl: 'https://testworkerthree.dev',
      //   };

      //   const response = await request(app.getHttpServer())
      //     .post('/developers')
      //     .send(developerData)
      //     .expect(201);

      //   console.log('Developer registration response:', JSON.stringify(response.body, null, 2));

      //   expect(response.body).toHaveProperty('message');
      //   expect(response.body).toHaveProperty('developerId');
      //   expect(response.body.message).toBe('Developer profile created successfully');

      //   console.info(`✅ Registered worker three as developer with ID: ${response.body.developerId}`);
      // });

      it('should connect user and obtain token', async () => {
        console.log('Connecting user and obtaining token...');

        const preparedConnection = await sdk.auth.prepareConnection(clientUserId);
        console.log('Connection data prepared');

        const response = await request(app.getHttpServer())
          .post('/auth/custom-connect')
          .send({ userId: clientUserId });

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

        authTokenClient = response.body.token;

        console.info(`✅ Connected user and obtained authentication token ${authTokenClient.substring(0, 20)}...`);
      });

      it('should connect worker one and obtain token', async () => {
        console.log('Connecting worker one and obtaining token...');

        const preparedConnection = await sdk.auth.prepareConnection(workerOneUserId);
        console.log('Connection data prepared');

        const response = await request(app.getHttpServer())
          .post('/auth/custom-connect')
          .send({ userId: workerOneUserId });

        console.log(`Connection status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.body, null, 2));

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = response.body;

        console.log("result", result);

        console.log('Connection completed successfully on the server:', 'success');
        console.log(JSON.stringify(result, null, 2));
        const resultCustom = await sdk.auth.sign(result.extrinsic);
        console.log("resultCustom", resultCustom);

        expect([200, 201]).toContain(response.status);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('extrinsic');

        authTokenWorkerOne = response.body.token;

        console.info(`✅ Connected worker one and obtained authentication token ${authTokenWorkerOne.substring(0, 20)}...`);
      });

      // it('should connect worker two and obtain token', async () => {
      //   console.log('Connecting worker two and obtaining token...');

      //   const preparedConnection = await sdk.auth.prepareConnection(workerTwoUserId);
      //   console.log('Connection data prepared');

      //   const response = await request(app.getHttpServer())
      //     .post('/auth/custom-connect')
      //     .send({ userId: workerTwoUserId });

      //   console.log(`Connection status: ${response.status}`);
      //   console.log('Response:', JSON.stringify(response.body, null, 2));

      //   if (!response.ok) {
      //     throw new Error(`Server responded with status: ${response.status}`);
      //   }

      //   const result = response.body;

      //   console.log("result", result);

      //   console.log('Connection completed successfully on the server:', 'success');
      //   console.log(JSON.stringify(result, null, 2));
      //   const resultCustom = await sdk.auth.sign(result.extrinsic);
      //   console.log("resultCustom", resultCustom);

      //   expect([200, 201]).toContain(response.status);
      //   expect(response.body).toHaveProperty('token');
      //   expect(response.body).toHaveProperty('extrinsic');

      //   authTokenWorkerTwo = response.body.token;

      //   console.info(`✅ Connected worker two and obtained authentication token ${authTokenWorkerTwo.substring(0, 20)}...`);
      // });

      // it('should connect worker three and obtain token', async () => {
      //   console.log('Connecting worker three and obtaining token...');

      //   const preparedConnection = await sdk.auth.prepareConnection(workerThreeUserId);
      //   console.log('Connection data prepared');

      //   const response = await request(app.getHttpServer())
      //     .post('/auth/custom-connect')
      //     .send({ userId: workerThreeUserId });

      //   console.log(`Connection status: ${response.status}`);
      //   console.log('Response:', JSON.stringify(response.body, null, 2));

      //   if (!response.ok) {
      //     throw new Error(`Server responded with status: ${response.status}`);
      //   }

      //   const result = response.body;

      //   console.log("result", result);

      //   console.log('Connection completed successfully on the server:', 'success');
      //   console.log(JSON.stringify(result, null, 2));
      //   // The user signs the transaction that starts the session on the server
      //   const resultCustom = await sdk.auth.sign(result.extrinsic);
      //   console.log("resultCustom", resultCustom);

      //   expect([200, 201]).toContain(response.status);
      //   expect(response.body).toHaveProperty('token');
      //   expect(response.body).toHaveProperty('extrinsic');

      //   authTokenWorkerThree = response.body.token;

      //   console.info(`✅ Connected worker three and obtained authentication token ${authTokenWorkerThree.substring(0, 20)}...`);
      // });
    });

    describe('📝 Listings & Developer Matching', () => {
      describe('Submitting a project proposal as a client', () => {
        describe('Calendar - Worker Registration', () => {
          it('should register worker one in the calendar', async () => {
            console.log('Registering worker one in calendar...');
            console.log(`Contract: ${calendarContractAddress}`);
            console.log(`Worker One: ${workerOneAccountId}`);

            expect(authTokenWorkerOne).toBeDefined();
            expect(calendarContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/calendar/${calendarContractAddress}/register_worker`)
              .set('Authorization', `Bearer ${authTokenWorkerOne}`)
              .send({ worker: workerOneAccountId });

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            console.info(`✅ Registered worker one ${workerOneAccountId.substring(0, 20)}... in calendar`);
          });

          // it('should register worker two in the calendar', async () => {
          //   console.log('Registering worker two in calendar...');
          //   console.log(`Contract: ${calendarContractAddress}`);
          //   console.log(`Worker Two: ${workerTwoAccountId}`);

          //   expect(authTokenWorkerTwo).toBeDefined();
          //   expect(calendarContractAddress).toBeDefined();

          //   const response = await request(app.getHttpServer())
          //     .post(`/calendar/${calendarContractAddress}/register_worker`)
          //     .set('Authorization', `Bearer ${authTokenWorkerTwo}`)
          //     .send({ worker: workerTwoAccountId });

          //   console.log('Response:', JSON.stringify(response.body, null, 2));

          //   expect(response.body).toHaveProperty('success', true);
          //   console.info(`✅ Registered worker two ${workerTwoAccountId.substring(0, 20)}... in calendar`);
          // });

          // it('should register worker three in the calendar', async () => {
          //   console.log('Registering worker three in calendar...');
          //   console.log(`Contract: ${calendarContractAddress}`);
          //   console.log(`Worker Three: ${workerThreeAccountId}`);

          //   expect(authTokenWorkerThree).toBeDefined();
          //   expect(calendarContractAddress).toBeDefined();

          //   const response = await request(app.getHttpServer())
          //     .post(`/calendar/${calendarContractAddress}/register_worker`)
          //     .set('Authorization', `Bearer ${authTokenWorkerThree}`)
          //     .send({ worker: workerThreeAccountId });

          //   console.log('Response:', JSON.stringify(response.body, null, 2));

          //   expect(response.body).toHaveProperty('success', true);
          //   console.info(`✅ Registered worker three ${workerThreeAccountId.substring(0, 20)}... in calendar`);
          // });
        });

        describe('Calendar - Set Availability ', () => {
          it('should set worker one availability', async () => {
            console.log('Setting worker one availability...');

            expect(authTokenWorkerOne).toBeDefined();
            expect(calendarContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/calendar/${calendarContractAddress}/set_availability`)
              .set('Authorization', `Bearer ${authTokenWorkerOne}`)
              .send({ availability: { type: "FullTime" } });

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            console.info('✅ Set worker one availability: 40 weekly hours');
          });

          // it('should set worker two availability', async () => {
          //   console.log('Setting worker two availability...');

          //   expect(authTokenWorkerTwo).toBeDefined();
          //   expect(calendarContractAddress).toBeDefined();

          //   const response = await request(app.getHttpServer())
          //     .post(`/calendar/${calendarContractAddress}/set_availability`)
          //     .set('Authorization', `Bearer ${authTokenWorkerTwo}`)
          //     .send({ availability: { type: "WeeklyHours", value: 30 } });

          //   console.log('Response:', JSON.stringify(response.body, null, 2));

          //   expect(response.body).toHaveProperty('success', true);
          //   console.info('✅ Set worker two availability: 30 weekly hours');
          // });

          // it('should set worker three availability', async () => {
          //   console.log('Setting worker three availability...');

          //   expect(authTokenWorkerThree).toBeDefined();
          //   expect(calendarContractAddress).toBeDefined();

          //   const response = await request(app.getHttpServer())
          //     .post(`/calendar/${calendarContractAddress}/set_availability`)
          //     .set('Authorization', `Bearer ${authTokenWorkerThree}`)
          //     .send({ availability: { type: "WeeklyHours", value: 20 } });

          //   console.log('Response:', JSON.stringify(response.body, null, 2));

          //   expect(response.body).toHaveProperty('success', true);
          //   console.info('✅ Set worker three availability: 20 weekly hours');
          // });
        });


        describe('Projects Module - Deploy Contract', () => {
          it('should deploy a new project contract', async () => {
            console.log('Deploying project contract...');
            console.log(`Using test-isolated contracts:`);
            console.log(`  - Ratings: ${ratingsContractAddress}`);
            console.log(`  - Calendar: ${calendarContractAddress}`);

            const deployData: CreateProposalRequest = {
              title: 'Test Project',
              summary: 'A test project summary',
              description: 'A test project description',
              url: 'https://example.com',
              projectType: 1,
              budget: 5000,
              deliveryTime: 30,
              calendarContract: calendarContractAddress,
              ratingsContract: ratingsContractAddress,
            };

            expect(authTokenClient).toBeDefined();
            expect(clientAccountId).toBeDefined();
            expect(calendarContractAddress).toBeDefined();
            expect(ratingsContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post('/projects/deploy/v5')
              .set('Authorization', `Bearer ${authTokenClient}`)
              .send(deployData)
              .expect(200);

            console.log('Deploy response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('projectId');
            expect(response.body).toHaveProperty('creationStatus', 'creating');
            expect(response.body).toHaveProperty('message');

            projectId = response.body.projectId;
            console.info(`✅ Project creation initiated with projectId: ${projectId}`);
          });

          it('should wait for project creation to complete and coordinator to be assigned', async () => {
            console.log('Waiting for project creation to complete and coordinator to be assigned...');

            expect(projectId).toBeDefined();

            // Poll for project creation status and coordinator assignment
            let creationStatus: string = 'creating';
            let coordinatorId: string | undefined;
            let attempts = 0;
            const maxAttempts = 180; // 180 seconds max wait time (project creation + coordinator assignment)

            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              
              const statusResponse = await request(app.getHttpServer())
                .get(`/projects/${projectId}/get_project_info`)
                .expect(200);

              creationStatus = statusResponse.body.creationStatus;
              attempts++;

              console.log(`Attempt ${attempts}/${maxAttempts}: Creation status: ${creationStatus}`);

              if (creationStatus === 'failed') {
                throw new Error(`Project creation failed: ${statusResponse.body.creationError || 'Unknown error'}`);
              }

              if (creationStatus === 'created') {
                contractAddress = statusResponse.body.contractAddress;
                expect(contractAddress).toBeDefined();
                
                // Verify coordinator was assigned
                if (statusResponse.body.consultantId) {
                  coordinatorId = statusResponse.body.consultantId;
                  console.info(`✅ Project created successfully with contractAddress: ${contractAddress.substring(0, 20)}...`);
                  console.info(`✅ Coordinator assigned with ID: ${coordinatorId}`);
                  break;
                } else {
                  console.log(`   Project created but coordinator not yet assigned, waiting... (${attempts}/${maxAttempts})`);
                }
              }
            }

            if (creationStatus !== 'created') {
              throw new Error(`Project creation timed out after 180 seconds. Final status: ${creationStatus}`);
            }

            if (!coordinatorId) {
              throw new Error('Project created but coordinator assignment timed out after 180 seconds');
            }
            expect(creationStatus).toBe('created');
            expect(contractAddress).toBeDefined();
            expect(coordinatorId).toBeDefined();
            
            const developerResponse = await request(app.getHttpServer())
              .get(`/developers/${coordinatorId}`)
              .expect(200);

            const coordinatorEmail = developerResponse.body.developer.email;
            expect(coordinatorEmail).toBeDefined();

            const federateServerUrl = 'http://localhost:3000/api';
            const addressResponse = await fetch(`${federateServerUrl}/get-user-address?userId=${encodeURIComponent(coordinatorEmail)}`);
            
            if (!addressResponse.ok) {
              throw new Error(`Failed to get coordinator address: ${addressResponse.status} ${addressResponse.statusText}`);
            }

            const addressData = await addressResponse.json() as { address: string };
            coordinatorAccountId = addressData.address;
            expect(coordinatorAccountId).toBeDefined();
            
            // Map coordinator address to the correct auth token
            const ss58Format = 2;
            const coordinatorSs58 = encodeAddress(coordinatorAccountId, ss58Format);
            const workerOneSs58 = encodeAddress(workerOneAccountId, ss58Format);
            // const workerTwoSs58 = encodeAddress(workerTwoAccountId, ss58Format);
            // const workerThreeSs58 = encodeAddress(workerThreeAccountId, ss58Format);

            if (coordinatorSs58 === workerOneSs58) {
              coordinatorAuthToken = authTokenWorkerOne;
              console.log('Coordinator is Worker One');
            // } else if (coordinatorSs58 === workerTwoSs58) {
            //   coordinatorAuthToken = authTokenWorkerTwo;
            //   console.log('Coordinator is Worker Two');
            // } else if (coordinatorSs58 === workerThreeSs58) {
            //   coordinatorAuthToken = authTokenWorkerThree;
            //   console.log('Coordinator is Worker Three');
            // } else {
            //   throw new Error(`Coordinator ${coordinatorAccountId} does not match any registered worker`);
            }

            expect(coordinatorAuthToken).toBeDefined();
            console.info(`   Using coordinator token for subsequent operations`);
          });

          it('should verify project was saved in MongoDB', async () => {
            console.log('Verifying project was saved in MongoDB...');

            expect(projectId).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_project_info`)
              .expect(200);

            console.log('MongoDB project data:', JSON.stringify(response.body, null, 2));

            expect(response.body).toBeDefined();
            expect(response.body).toHaveProperty('contractAddress', contractAddress);
            expect(response.body).toHaveProperty('title', 'Test Project');
            expect(response.body).toHaveProperty('summary', 'A test project summary');
            expect(response.body).toHaveProperty('description', 'A test project description');
            expect(response.body).toHaveProperty('url', 'https://example.com');
            expect(response.body).toHaveProperty('projectType', 1);
            expect(response.body).toHaveProperty('budget', 5000);
            expect(response.body).toHaveProperty('deliveryTime', 30);
            expect(response.body).toHaveProperty('state', 'deployed');
            expect(response.body).toHaveProperty('clientId', clientId.toString());

            console.info(`✅ Verified project data in MongoDB for project ${projectId}`);
          });

        });

        describe('Coordinator Approval Process', () => {
          it('should approve project with milestones and propose scope', async () => {
            console.log('Coordinator approving project with milestones...');

            expect(coordinatorAuthToken).toBeDefined();
            expect(projectId).toBeDefined();
            console.log(`Using coordinator: ${coordinatorAccountId}`);

            const approvalData = {
              milestones: [
                {
                  title: 'Milestone 1: Backend Development',
                  description: 'Complete backend API',
                  budget: 3000,
                  deliveryTime: 15,
                  deliveryDate: '2024-12-15',
                  role: 'Backend Developer',
                  proficiency: 'Senior',
                  skills: ['Rust', 'Javascript', 'PostgreSQL'],
                  availability: 'fulltime'
                },
                // {
                //   title: 'Milestone 2: Frontend Development',
                //   description: 'Complete frontend UI',
                //   budget: 2000,
                //   deliveryTime: 10,
                //   deliveryDate: '2024-12-25',
                //   role: 'UX Designer',
                //   proficiency: 'Mid-level',
                //   skills: ['HTML5', 'CSS3', 'Figma'],
                //   availability: 'parttime'
                // }
              ],
              advance_payment_percentage: 20,
              document_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
            };

            const response = await request(app.getHttpServer())
              .post(`/projects/${projectId}/propose_scope`)
              .set('Authorization', `Bearer ${coordinatorAuthToken}`)
              .send(approvalData)
              .expect(201);

            console.log('Approval response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('status', 'approved');
            expect(response.body).toHaveProperty('milestones');
            expect(response.body.milestones).toHaveLength(approvalData.milestones.length);
            expect(response.body).toHaveProperty('proposeResult');

            console.info(`✅ Project approved with ${response.body.milestones.length} milestones and scope proposed`);
          });

          it('should verify project status was updated to approved', async () => {
            console.log('Verifying project status after approval...');

            expect(projectId).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_project_info`)
              .expect(200);

            console.log('Project status:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('coordinatorApprovalStatus', 'approved');
            expect(response.body).toHaveProperty('state', 'scope_proposed');

            console.info(`✅ Project status updated: ${response.body.state}`);
          });

          it('should verify milestones were created in MongoDB', async () => {
            console.log('Verifying milestones in MongoDB...');

            expect(projectId).toBeDefined();
            expect(coordinatorAuthToken).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_all_tasks`)
              .set('Authorization', `Bearer ${coordinatorAuthToken}`)
              .expect(200);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('milestones');
            expect(Array.isArray(response.body.milestones)).toBe(true);
            expect(response.body.milestones.length).toBe(1);

            expect(response.body.milestones[0]).toHaveProperty('title', 'Milestone 1: Backend Development');
            expect(response.body.milestones[0]).toHaveProperty('budget', 3000);
            expect(response.body.milestones[0]).toHaveProperty('role', 'Backend Developer');
            expect(response.body.milestones[0]).toHaveProperty('proficiency', 'Senior');
            expect(response.body.milestones[0].skills).toEqual(['Rust', 'Javascript', 'PostgreSQL']);
            expect(response.body.milestones[0]).toHaveProperty('neededFullTimeDeveloper', true);
            // expect(response.body.milestones[1]).toHaveProperty('title', 'Milestone 2: Frontend Development');
            // expect(response.body.milestones[1]).toHaveProperty('budget', 2000);
            // expect(response.body.milestones[1]).toHaveProperty('role', 'UX Designer');
            // expect(response.body.milestones[1]).toHaveProperty('proficiency', 'Mid-level');
            // expect(response.body.milestones[1].skills).toEqual(['HTML5', 'CSS3', 'Figma']);
            // expect(response.body.milestones[1]).toHaveProperty('neededPartTimeDeveloper', true);

            console.info(`✅ Verified ${response.body.milestones.length} milestones in MongoDB`);
          });

          it('should verify scope was proposed to contract', async () => {
            console.log('Verifying scope in contract...');

            expect(projectId).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_scope_info`)
              .expect(200);

            console.log('Scope info:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('response');
            expect(response.body.response).toBeDefined();

            console.info('✅ Verified scope was proposed to contract');
          });
        });
      });

      describe('Projects Module - Approve Scope', () => {
        it('should approve scope tasks', async () => {
          console.log('Approving scope tasks...');

          expect(authTokenClient).toBeDefined();
          expect(projectId).toBeDefined();

          console.log('Querying all tasks from contract...');
          const tasksResponse = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_all_tasks`)
            .expect(200);

          console.log('All tasks:', JSON.stringify(tasksResponse.body, null, 2));

          expect(tasksResponse.body).toHaveProperty('success', true);
          expect(tasksResponse.body).toHaveProperty('response');
          expect(Array.isArray(tasksResponse.body.response)).toBe(true);
          expect(tasksResponse.body.response.length).toBeGreaterThan(0);

          const taskIds = tasksResponse.body.response.map((task: any) => task.id);
          console.log(`Found ${taskIds.length} task(s) with IDs: [${taskIds.join(', ')}]`);

          const approvedTaskIds = taskIds;

          const response = await request(app.getHttpServer())
            .post(`/projects/${projectId}/approve_scope`)
            .set('Authorization', `Bearer ${authTokenClient}`)
            .send({ approved_task_ids: approvedTaskIds })
            .expect(201);

          console.log('Approve scope response:', JSON.stringify(response.body, null, 2));

          expect(response.body).toHaveProperty('success');
          expect(response.body.success).toBe(true);
          console.info(`✅ Approved scope with ${approvedTaskIds.length} task(s): [${approvedTaskIds.join(', ')}]`);

          // Wait for the transaction to be processed and contract state to update to ScopeAccepted
          // This is necessary because blockchain transactions take time to be finalized
          console.log('Waiting for contract state to update to ScopeAccepted...');
          await new Promise(resolve => setTimeout(resolve, 50000)); // Increased wait time
          console.info('✅ Waited for contract state update');
        });
      });

      describe('Projects Module - Assign Team', () => {
        it('should assign a team to the project', async () => {
          console.log('Assigning team to project...');

          expect(coordinatorAuthToken).toBeDefined();
          expect(projectId).toBeDefined();

          // Get milestones to determine team size
          const milestonesResponse = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_all_tasks`)
            .expect(200);

          expect(milestonesResponse.body).toHaveProperty('milestones');
          expect(Array.isArray(milestonesResponse.body.milestones)).toBe(true);
          const teamSize = milestonesResponse.body.milestones.length;
          expect(teamSize).toBeGreaterThan(0);

          console.log(`Assigning team of size ${teamSize} based on ${milestonesResponse.body.milestones.length} milestone(s)`);

          const response = await request(app.getHttpServer())
            .post(`/projects/${projectId}/assign_team`)
            .set('Authorization', `Bearer ${coordinatorAuthToken}`)
            .send({ _team_size: teamSize })
            .expect(201);

          console.log('Response:', JSON.stringify(response.body, null, 2));

          expect(response.body).toHaveProperty('success');
          expect(response.body.success).toBe(true);
          console.info(`✅ Assigned team (size: ${teamSize}) to project ${projectId}`);
        });

        it('should wait for team assignment and advance payment creation to complete', async () => {
          console.log('Waiting for team assignment and advance payment creation...');

          expect(projectId).toBeDefined();

          // Wait for team assignment to complete and advance payment to be created
          let teamAssigned = false;
          let attempts = 0;
          const maxAttempts = 60; // 60 seconds max wait time

          while (attempts < maxAttempts && !teamAssigned) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_team`)
              .expect(200);

            console.log(`Attempt ${attempts + 1}/${maxAttempts}: Team response:`, JSON.stringify(response.body, null, 2));

            if (response.body.success && response.body.response && Array.isArray(response.body.response) && response.body.response.length > 0) {
              teamAssigned = true;
              console.info(`✅ Team assigned: ${response.body.response.length} member(s)`);
              break;
            }

            attempts++;
          }

          if (!teamAssigned) {
            throw new Error(`Team assignment timed out after ${maxAttempts} seconds`);
          }

          const finalResponse = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_team`)
            .expect(200);

          expect(finalResponse.body).toBeDefined();
          expect(finalResponse.body).toHaveProperty('success', true);
          expect(finalResponse.body).toHaveProperty('response');
          expect(Array.isArray(finalResponse.body.response)).toBe(true);
          expect(finalResponse.body.response.length).toBeGreaterThan(0);
          console.info(`✅ Verified team information: ${finalResponse.body.response.length} member(s)`);
        });
      });

      describe('Projects Module - Queries', () => {
        it('should get project information', async () => {
          console.log('Getting project information...');

          expect(projectId).toBeDefined();

          const response = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_project_info`)
            .expect(200);

          console.log('Response:', JSON.stringify(response.body, null, 2));

          expect(response.body).toBeDefined();
          expect(response.body).toHaveProperty('contractAddress', contractAddress);
          expect(response.body).toHaveProperty('title', 'Test Project');
          expect(response.body).toHaveProperty('summary', 'A test project summary');
          expect(response.body).toHaveProperty('description', 'A test project description');
          expect(response.body).toHaveProperty('budget', 5000);
          expect(response.body).toHaveProperty('deliveryTime', 30);
          expect(response.body).toHaveProperty('projectType', 1);
          expect(response.body).toHaveProperty('state', 'scope_proposed');
          expect(response.body).toHaveProperty('coordinatorApprovalStatus', 'approved');
          expect(response.body).toHaveProperty('consultantId');

          console.info(`✅ Retrieved project information: "${response.body.title}"`);
        });

        it('should get all tasks and milestones', async () => {
          console.log('Getting all tasks and milestones...');

          expect(projectId).toBeDefined();

          const response = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_all_tasks`)
            .expect(200);

          console.log('Response:', JSON.stringify(response.body, null, 2));

          expect(response.body).toBeDefined();
          expect(response.body).toHaveProperty('success', true);
          expect(response.body).toHaveProperty('response');
          expect(Array.isArray(response.body.response)).toBe(true);
          expect(response.body.response.length).toBeGreaterThanOrEqual(1);

          const task = response.body.response[0];
          expect(task).toHaveProperty('id');
          expect(typeof task.id).toBe('number');
          expect(task).toHaveProperty('cost');
          expect(task).toHaveProperty('complexity');
          expect(task.complexity).toHaveProperty('type');
          expect(task.complexity).toHaveProperty('value');

          expect(response.body).toHaveProperty('milestones');
          expect(Array.isArray(response.body.milestones)).toBe(true);
          expect(response.body.milestones.length).toBeGreaterThanOrEqual(1);

          const milestone = response.body.milestones[0];
          expect(milestone).toHaveProperty('contractAddress', contractAddress);
          expect(milestone).toHaveProperty('title');
          expect(milestone).toHaveProperty('budget');
          expect(milestone).toHaveProperty('deliveryTime');

          console.info(`✅ Retrieved ${response.body.response.length} task(s) from contract and ${response.body.milestones.length} milestone(s) from MongoDB`);
        });

        it('should get specific task information and milestone', async () => {
          console.log('Getting specific task information...');

          expect(projectId).toBeDefined();

          const allTasksResponse = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_all_tasks`)
            .expect(200);

          expect(allTasksResponse.body).toHaveProperty('response');
          expect(Array.isArray(allTasksResponse.body.response)).toBe(true);
          expect(allTasksResponse.body.response.length).toBeGreaterThan(0);

          const firstTaskId = allTasksResponse.body.response[0].id;
          console.log(`Querying task with ID: ${firstTaskId}`);

          const response = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_task?task_id=${firstTaskId}`)
            .expect(200);

          console.log('Response:', JSON.stringify(response.body, null, 2));

          expect(response.body).toBeDefined();
          expect(response.body).toHaveProperty('success', true);

          expect(response.body).toHaveProperty('response');
          const task = response.body.response;
          expect(task).toHaveProperty('id', firstTaskId);
          expect(task).toHaveProperty('cost');
          expect(typeof task.cost).toBe('string');
          expect(task).toHaveProperty('complexity');
          expect(task.complexity).toHaveProperty('type');
          expect(task.complexity).toHaveProperty('value');

          expect(response.body).toHaveProperty('milestone');
          const milestone = response.body.milestone;
          expect(milestone).toBeDefined();
          expect(milestone).toHaveProperty('id', firstTaskId);
          expect(milestone).toHaveProperty('contractAddress', contractAddress);
          expect(milestone).toHaveProperty('title');
          expect(milestone).toHaveProperty('budget');
          expect(milestone).toHaveProperty('deliveryTime');

          console.info(`✅ Retrieved task #${task.id} and milestone #${milestone.id}: ${task.complexity.type} (${task.complexity.value}), cost: ${task.cost}, milestone: ${milestone.title}`);
        });

        it('should get task completion status before approval', async () => {
          console.log('Getting task completion status before approval...');

          expect(projectId).toBeDefined();

          const allTasksResponse = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_all_tasks`)
            .expect(200);

          expect(allTasksResponse.body).toHaveProperty('response');
          expect(Array.isArray(allTasksResponse.body.response)).toBe(true);
          expect(allTasksResponse.body.response.length).toBeGreaterThan(0);

          const firstTaskId = allTasksResponse.body.response[0].id;
          console.log(`Querying task completion status for task ID: ${firstTaskId}`);

          const response = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_task_completion_status?task_id=${firstTaskId}`)
            .expect(200);

          console.log('Response:', JSON.stringify(response.body, null, 2));

          expect(response.body).toBeDefined();
          expect(response.body).toHaveProperty('success', true);
          expect(response.body).toHaveProperty('response');

          expect(response.body).toHaveProperty('milestoneState', 'pending');
          console.log(`Milestone state in MongoDB: ${response.body.milestoneState}`);

          const taskStatus = response.body.response;
          expect(taskStatus).toBeDefined();
          console.log(`Task completion status from contract:`, taskStatus);

          console.info(`✅ Retrieved task #${firstTaskId} completion status - Milestone state: ${response.body.milestoneState}, Task status: ${JSON.stringify(taskStatus)}`);
        });

        it('should submit a task for review', async () => {
          console.log('Submitting a task for review...');

          expect(coordinatorAuthToken).toBeDefined();
          expect(projectId).toBeDefined();

          // Get all tasks to find a task ID
          const tasksResponse = await request(app.getHttpServer())
            .get(`/projects/${projectId}/get_all_tasks`)
            .expect(200);

          expect(tasksResponse.body).toHaveProperty('success', true);
          expect(tasksResponse.body).toHaveProperty('response');
          expect(Array.isArray(tasksResponse.body.response)).toBe(true);
          expect(tasksResponse.body.response.length).toBeGreaterThan(0);

          const firstTaskId = tasksResponse.body.response[0].id;
          console.log(`Submitting task with ID: ${firstTaskId} for review`);

          // Submit task for review
          const reviewResponse = await request(app.getHttpServer())
            .post(`/projects/${projectId}/submit_task_for_review`)
            .set('Authorization', `Bearer ${coordinatorAuthToken}`)
            .send({ task_id: firstTaskId })
            .expect(201);

          console.log('Response:', JSON.stringify(reviewResponse.body, null, 2));

          expect(reviewResponse.body).toHaveProperty('success');
          expect(reviewResponse.body.success).toBe(true);
          console.info(`✅ Submitted task #${firstTaskId} for review`);
        });

        describe('Projects Module - Task Management', () => {
          it('should complete a task', async () => {
            console.log('Completing task 1...');

            expect(authTokenClient).toBeDefined();
            expect(projectId).toBeDefined();

            // First get all tasks to find a task ID
            const tasksResponse = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_all_tasks`)
              .expect(200);

            expect(tasksResponse.body).toHaveProperty('success', true);
            expect(tasksResponse.body).toHaveProperty('response');
            expect(Array.isArray(tasksResponse.body.response)).toBe(true);
            expect(tasksResponse.body.response.length).toBeGreaterThan(0);

            const firstTaskId = tasksResponse.body.response[0].id;
            console.log(`Completing task with ID: ${firstTaskId}`);

            const response = await request(app.getHttpServer())
              .post(`/projects/${projectId}/complete_task`)
              .set('Authorization', `Bearer ${authTokenClient}`)
              .send({ task_id: firstTaskId })
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.info(`✅ Completed task #${firstTaskId}`);
          });
        });

        // });

        describe('Projects Module - Project Completion', () => {
          it('should mark project as completed', async () => {
            console.log('Marking project as completed...');

            expect(authTokenClient).toBeDefined();
            expect(projectId).toBeDefined();

            // First get team members to create ratings
            const teamResponse = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_team`)
              .expect(200);

            expect(teamResponse.body).toHaveProperty('success', true);
            const teamMembers = teamResponse.body.response;
            console.log('Team members:', JSON.stringify(teamMembers, null, 2));
            expect(Array.isArray(teamMembers)).toBe(true);
            expect(teamMembers.length).toBeGreaterThan(0);

            // Create ratings for each team member
            const ratings = teamMembers.map((member: any) => [member.account_id, 8]);

            const response = await request(app.getHttpServer())
              .post(`/projects/${projectId}/mark_completed`)
              .set('Authorization', `Bearer ${authTokenClient}`)
              .send({ ratings })
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.log('Project marked as completed successfully');
            console.info(`✅ Marked project as completed with ${ratings.length} rating(s)`);
            console.info('\n✅ Developer team assembly and project execution completed successfully!\n');
          });

          it('should verify project delivery date was set after completion', async () => {
            console.log('Verifying project delivery date was set...');

            expect(projectId).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${projectId}/get_project_info`)
              .expect(200);

            console.log('Project info:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('deliveryDate');
            expect(response.body.deliveryDate).toBeDefined();

            console.info(`✅ Verified delivery date was set: ${new Date(response.body.deliveryDate).toISOString()}`);
          });
        });


        // TODO: Fix coordinator rejection process, CONTRACT TRAPPED IN THE BLOCKCHAIN
        // describe('Coordinator Rejection Process', () => {
        //   it('should deploy a second project for rejection test', async () => {
        //     console.log('Deploying second project contract for rejection test...');

        //     // Using default contracts automatically
        //     const deployData = {
        //       title: 'Test Project - To Be Rejected',
        //       summary: 'A test project that will be rejected',
        //       description: 'This project will be rejected by the coordinator',
        //       url: 'https://example.com/rejected',
        //       projectType: 1,
        //       budget: 3000,
        //       deliveryTime: 20,
        //       deliveryDate: '2024-12-20',
        //       clientId: 1,
        //     };

        //     expect(authTokenClient).toBeDefined();

        //     const response = await request(app.getHttpServer())
        //       .post('/projects/deploy/v5')
        //       .set('Authorization', `Bearer ${authTokenClient}`)
        //       .send(deployData)
        //       .expect(201);

        //     console.log('Deploy response:', JSON.stringify(response.body, null, 2));

        //     expect(response.body).toHaveProperty('success');
        //     expect(response.body).toHaveProperty('address');

        //     rejectedContractAddress = response.body.address;
        //     console.info(`✅ Deployed second project at: ${rejectedContractAddress.substring(0, 20)}...`);
        //   });

        //   it('should verify coordinator was assigned to second project', async () => {
        //     console.log('Verifying coordinator for second project...');

        //     expect(rejectedContractAddress).toBeDefined();

        //     const response = await request(app.getHttpServer())
        //       .get(`/projects/${rejectedContractAddress}`)
        //       .expect(200);

        //     console.log('Second project with coordinator:', JSON.stringify(response.body, null, 2));

        //     expect(response.body).toHaveProperty('consultantId');
        //     expect(response.body.consultantId).toBeTruthy();

        //     // Save coordinator address and determine which worker token to use
        //     rejectedCoordinatorAccountId = response.body.consultantId;

        //     // Map coordinator address to the correct auth token
        //     if (rejectedCoordinatorAccountId === workerOneAccountId) {
        //       rejectedCoordinatorAuthToken = authTokenWorkerOne;
        //       console.log('Second project coordinator is Worker One');
        //     } else if (rejectedCoordinatorAccountId === workerTwoAccountId) {
        //       rejectedCoordinatorAuthToken = authTokenWorkerTwo;
        //       console.log('Second project coordinator is Worker Two');
        //     } else if (rejectedCoordinatorAccountId === workerThreeAccountId) {
        //       rejectedCoordinatorAuthToken = authTokenWorkerThree;
        //       console.log('Second project coordinator is Worker Three');
        //     } else {
        //       throw new Error(`Coordinator ${rejectedCoordinatorAccountId} does not match any registered worker`);
        //     }

        //     console.info(`✅ Second project coordinator: ${rejectedCoordinatorAccountId}`);
        //   });

        //   it('should reject project with reason', async () => {
        //     console.log('Coordinator rejecting project...');

        //     expect(rejectedCoordinatorAuthToken).toBeDefined();
        //     expect(rejectedContractAddress).toBeDefined();
        //     console.log(`Using coordinator: ${rejectedCoordinatorAccountId}`);

        //     const rejectionData = {
        //       rejectionReason: 'Project scope is unclear and budget is insufficient'
        //     };

        //     const response = await request(app.getHttpServer())
        //       .post(`/projects/${rejectedContractAddress}/coordinator_reject`)
        //       .set('Authorization', `Bearer ${rejectedCoordinatorAuthToken}`)
        //       .send(rejectionData)
        //       .expect(201);

        //     console.log('Rejection response:', JSON.stringify(response.body, null, 2));

        //     expect(response.body).toHaveProperty('success', true);
        //     expect(response.body).toHaveProperty('status', 'rejected');

        //     console.info('✅ Project rejected by coordinator');
        //   });

        //   it('should verify project status was updated to rejected', async () => {
        //     console.log('Verifying project status after rejection...');

        //     expect(rejectedContractAddress).toBeDefined();

        //     const response = await request(app.getHttpServer())
        //       .get(`/projects/${rejectedContractAddress}`)
        //       .expect(200);

        //     console.log('Rejected project data:', JSON.stringify(response.body, null, 2));

        //     expect(response.body).toHaveProperty('coordinatorApprovalStatus', 'rejected');
        //     expect(response.body).toHaveProperty('state', 'rejected_by_coordinator');
        //     expect(response.body).toHaveProperty('coordinatorRejectionReason', 'Project scope is unclear and budget is insufficient');

        //     console.info(`✅ Project status updated to rejected with reason`);
        //   });
        // });
      });
    });
  });
});