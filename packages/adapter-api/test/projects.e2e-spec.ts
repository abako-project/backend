import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SDK } from '@virtonetwork/sdk';


describe('Projects Module E2E Tests', () => {
  let app: INestApplication;
  let sdk: SDK;
  let authTokenClient: string;
  let authTokenWorker: string;
  let clientUserId: string;
  let workerUserId: string;
  let clientAccountId: string;
  let workerAccountId: string;
  let contractAddress: string;
  let rejectedContractAddress: string;
  const defaultRatingsContract = 'JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY';
  const defaultCalendarContract = 'Cfqrpkb3Fs17DBpQR5UmBq3bDzaDTnFe89RK9EwZvPWtJpr';
  let calendarContractAddress: string = defaultCalendarContract;
  let ratingsContractAddress: string = defaultRatingsContract;

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
    clientUserId = `test-projects-user-${Date.now()}@example.com`;
    workerUserId = `test-projects-worker-${Date.now()}@example.com`;

    console.log('Application started successfully');
    console.log('Client SDK initialized');
    console.log(`Test user: ${clientUserId}`);
  });

  afterAll(async () => {
    console.info('='.repeat(80) + '\n');
    await app.close();
  });

  describe('Complete Workflow: PolkaTalent Platform', () => {
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

      it('should register a new worker', async () => {
        console.log('Registering new user...');

        const userData = {
          profile: {
            id: workerUserId,
            name: 'Projects Test Client User',
          }
        };

        const preparedData = await sdk.auth.prepareRegistration(userData);

        workerAccountId = preparedData.passAccountAddress;

        const response = await request(app.getHttpServer())
          .post('/auth/custom-register')
          .send(preparedData);

        console.log('User registered:', response.body.success);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.body).toHaveProperty('success', true);
        
        console.info(`✅ Registered new worker: ${workerUserId.substring(0, 20)}...`);
      });

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

      it('should connect worker and obtain token', async () => {
        console.log('Connecting user and obtaining token...');

        const preparedConnection = await sdk.auth.prepareConnection(workerUserId);
        console.log('Connection data prepared');

        const response = await request(app.getHttpServer())
          .post('/auth/custom-connect')
          .send({ userId: workerUserId });

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

        authTokenWorker = response.body.token;

        console.info(`✅ Connected worker and obtained authentication token ${authTokenWorker.substring(0, 20)}...`);
      });
    });

    describe('📝 Listings & Developer Matching', () => {
      describe('Submitting a project proposal as a client', () => {

        describe('Calendar - Worker Registration', () => {
          it('should register a worker in the calendar', async () => {
            console.log('Registering worker in calendar...');
            console.log(`Contract: ${calendarContractAddress}`);
            console.log(`Worker: ${workerAccountId}`);

            expect(authTokenWorker).toBeDefined();
            expect(calendarContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/calendar/${calendarContractAddress}/register_worker`)
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .send({ worker: workerAccountId });

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            console.info(`✅ Registered worker ${workerAccountId.substring(0, 20)}... in calendar`);
          });
        });

        describe('Calendar - Set Availability ', () => {
          it('should set availability', async () => {
            console.log('Attempting set_availability...');

            expect(authTokenWorker).toBeDefined();
            expect(calendarContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/calendar/${calendarContractAddress}/set_availability`)
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .send({ availability: { WeeklyHours: 40 } });

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            console.info('✅ Set availability: 40 weekly hours');
          });
        });

        describe('Calendar - Admin Operations', () => {
          it('should set 40 hours availability for main worker as admin', async () => {
            console.log('Admin setting 40 hours for main worker...');

            expect(authTokenWorker).toBeDefined();
            expect(workerAccountId).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/calendar/${calendarContractAddress}/admin_set_worker_availability`)
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .send({
                worker: workerAccountId,
                availability: { type: "WeeklyHours", value: 40 }
              });

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            console.log('40 hours availability set by admin for main worker');
            console.info('✅ Set availability: 40 weekly hours for worker: ${workerAccountId}');
          });

        });

        describe('Projects Module - Deploy Contract', () => {
          it('should deploy a new project contract', async () => {
            console.log('Deploying project contract...');
            
            const deployData = {
              title: 'Test Project',
              summary: 'A test project summary',
              description: 'A test project description',
              url: 'https://example.com',
              projectType: 1,
              budget: 5000,
              deliveryTime: 30,
              deliveryDate: '2024-12-31',
              clientId: clientAccountId,
            };

            expect(authTokenClient).toBeDefined();
            expect(clientAccountId).toBeDefined();

            const response = await request(app.getHttpServer())
              .post('/projects/deploy/v5')
              .set('Authorization', `Bearer ${authTokenClient}`)
              .send(deployData)
              .expect(201);

            console.log('Deploy response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('address');

            contractAddress = response.body.address;
            console.info(`✅ Deployed project contract "${deployData.title}" at: ${contractAddress.substring(0, 20)}...`);
          });

          it('should verify project was saved in MongoDB', async () => {
            console.log('Verifying project was saved in MongoDB...');

            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}`)
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
            expect(response.body).toHaveProperty('clientId', clientAccountId);

            console.info(`✅ Verified project data in MongoDB for contract ${contractAddress.substring(0, 20)}...`);
          });

          it('should verify coordinator was assigned automatically', async () => {
            console.log('Verifying coordinator was assigned automatically...');

            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}`)
              .expect(200);

            console.log('Project with coordinator:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('consultantId');
            expect(response.body.consultantId).toBeTruthy();

            console.info(`✅ Coordinator assigned automatically: ${response.body.consultantId}`);
          });
        });

        describe('Coordinator Approval Process', () => {
          it('should approve project with milestones and propose scope', async () => {
            console.log('Coordinator approving project with milestones...');

            expect(authTokenWorker).toBeDefined();
            expect(contractAddress).toBeDefined();

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
                {
                  title: 'Milestone 2: Frontend Development',
                  description: 'Complete frontend UI',
                  budget: 2000,
                  deliveryTime: 10,
                  deliveryDate: '2024-12-25',
                  role: 'UX Designer',
                  proficiency: 'Mid-level',
                  skills: ['HTML5', 'CSS3', 'Figma'],
                  availability: 'parttime'
                }
              ],
              advance_payment_percentage: 20,
              document_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
            };

            const response = await request(app.getHttpServer())
              .post(`/projects/${contractAddress}/propose_scope`)
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .send(approvalData)
              .expect(201);

            console.log('Approval response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('status', 'approved');
            expect(response.body).toHaveProperty('milestones');
            expect(response.body.milestones).toHaveLength(2);
            expect(response.body).toHaveProperty('proposeResult');

            console.info(`✅ Project approved with ${response.body.milestones.length} milestones and scope proposed`);
          });

          it('should verify project status was updated to approved', async () => {
            console.log('Verifying project status after approval...');

            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}`)
              .expect(200);

            console.log('Project status:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('coordinatorApprovalStatus', 'approved');
            expect(response.body).toHaveProperty('state', 'scope_proposed');

            console.info(`✅ Project status updated: ${response.body.state}`);
          });

          it('should verify milestones were created in MongoDB', async () => {
            console.log('Verifying milestones in MongoDB...');

            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}/milestones`)
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .expect(200);

            console.log('Milestones:', JSON.stringify(response.body, null, 2));

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body[0]).toHaveProperty('title', 'Milestone 1: Backend Development');
            expect(response.body[0]).toHaveProperty('budget', 3000);
            expect(response.body[0]).toHaveProperty('role', 'Backend Developer');
            expect(response.body[0]).toHaveProperty('proficiency', 'Senior');
            expect(response.body[0].skills).toEqual(['Rust', 'Javascript', 'PostgreSQL']);
            expect(response.body[0]).toHaveProperty('neededFullTimeDeveloper', true);
            expect(response.body[1]).toHaveProperty('title', 'Milestone 2: Frontend Development');
            expect(response.body[1]).toHaveProperty('budget', 2000);
            expect(response.body[1]).toHaveProperty('role', 'UX Designer');
            expect(response.body[1]).toHaveProperty('proficiency', 'Mid-level');
            expect(response.body[1].skills).toEqual(['HTML5', 'CSS3', 'Figma']);
            expect(response.body[1]).toHaveProperty('neededPartTimeDeveloper', true);

            console.info(`✅ Verified ${response.body.length} milestones in MongoDB`);
          });

          it('should verify scope was proposed to contract', async () => {
            console.log('Verifying scope in contract...');

            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}/get_scope_info`)
              .expect(200);

            console.log('Scope info:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('response');
            expect(response.body.response).toBeDefined();

            console.info('✅ Verified scope was proposed to contract');
          });
        });

        describe('Coordinator Rejection Process', () => {
          it('should deploy a second project for rejection test', async () => {
            console.log('Deploying second project contract for rejection test...');

            // Using default contracts automatically
            const deployData = {
              title: 'Test Project - To Be Rejected',
              summary: 'A test project that will be rejected',
              description: 'This project will be rejected by the coordinator',
              url: 'https://example.com/rejected',
              projectType: 1,
              budget: 3000,
              deliveryTime: 20,
              deliveryDate: '2024-12-20',
              clientId: 1,
            };

            expect(authTokenWorker).toBeDefined();

            const response = await request(app.getHttpServer())
              .post('/projects/deploy/v5')
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .send(deployData)
              .expect(201);

            console.log('Deploy response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('address');

            rejectedContractAddress = response.body.address;
            console.info(`✅ Deployed second project at: ${rejectedContractAddress.substring(0, 20)}...`);
          });

          it('should reject project with reason', async () => {
            console.log('Coordinator rejecting project...');

            expect(authTokenWorker).toBeDefined();
            expect(rejectedContractAddress).toBeDefined();

            const rejectionData = {
              rejectionReason: 'Project scope is unclear and budget is insufficient'
            };

            const response = await request(app.getHttpServer())
              .post(`/projects/${rejectedContractAddress}/coordinator_reject`)
              .set('Authorization', `Bearer ${authTokenWorker}`)
              .send(rejectionData)
              .expect(201);

            console.log('Rejection response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('status', 'rejected');

            console.info('✅ Project rejected by coordinator');
          });

          it('should verify project status was updated to rejected', async () => {
            console.log('Verifying project status after rejection...');

            expect(rejectedContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${rejectedContractAddress}`)
              .expect(200);

            console.log('Rejected project data:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('coordinatorApprovalStatus', 'rejected');
            expect(response.body).toHaveProperty('state', 'rejected_by_coordinator');
            expect(response.body).toHaveProperty('coordinatorRejectionReason', 'Project scope is unclear and budget is insufficient');

            console.info(`✅ Project status updated to rejected with reason`);
          });
        });
      });

      // describe('Assembling developer team', () => {
      //   describe('Projects Module - Assign Team', () => {
      //     it('should assign a team to the project', async () => {
      //       console.log('Assigning team to project...');
            
      //       expect(authToken).toBeDefined();
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .post(`/projects/${contractAddress}/assign_team`)
      //         .set('Authorization', `Bearer ${authToken}`)
      //         .send({ideal_team_size: 1})
      //         .expect(201);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toHaveProperty('success');
      //       expect(response.body.success).toBe(true);
      //       console.info(`✅ Assigned team (ideal size: 1) to project ${contractAddress.substring(0, 20)}...`);
      //     });
      //   });


      //   describe('Projects Module - Approve Scope', () => {
      //     it('should approve scope tasks', async () => {
      //       console.log('Approving scope tasks...');
            
      //       expect(authToken).toBeDefined();
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .post(`/projects/${contractAddress}/approve_scope`)
      //         .set('Authorization', `Bearer ${authToken}`)
      //         .send({ approved_task_ids: [1] })
      //         .expect(201);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toHaveProperty('success');
      //       expect(response.body.success).toBe(true);
      //       const approvedTasks = [1];
      //       console.info(`✅ Approved scope with ${approvedTasks.length} task(s): [${approvedTasks.join(', ')}]`);
      //     });
      //   });

      //   describe('Projects Module - Queries', () => {
      //     it('should get project information', async () => {
      //       console.log('Getting project information...');
            
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_project_info`)
      //         .expect(200);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toBeDefined();
      //       expect(response.body).toHaveProperty('success', true);
      //       expect(response.body).toHaveProperty('response');
            
      //       // Verify project name matches what was deployed
      //       const projectName = response.body.response[0];
      //       expect(projectName).toBe('Test Project');
            
      //       console.info(`✅ Retrieved project information: "${projectName}"`);
      //     });

      //     it('should get all tasks', async () => {
      //       console.log('Getting all tasks...');
            
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_all_tasks`)
      //         .expect(200);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toBeDefined();
      //       expect(response.body).toHaveProperty('success', true);
      //       expect(response.body).toHaveProperty('response');
      //       expect(Array.isArray(response.body.response)).toBe(true);
      //       expect(response.body.response.length).toBeGreaterThanOrEqual(1);
            
      //       // Verify task structure matches expected format
      //       const task = response.body.response[0];
      //       expect(task).toHaveProperty('id', 1);
      //       expect(task).toHaveProperty('cost', '1000');
      //       expect(task).toHaveProperty('complexity');
      //       expect(task.complexity).toHaveProperty('type', 'Days');
      //       expect(task.complexity).toHaveProperty('value', 5);
            
      //       console.info(`✅ Retrieved all tasks: ${response.body.response.length} task(s) found`);
      //     });

      //     it('should get specific task information (task 1)', async () => {
      //       console.log('Getting specific task information for task 1...');
            
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_task?task_id=1`)
      //         .expect(200);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toBeDefined();
      //       expect(response.body).toHaveProperty('success', true);
      //       expect(response.body).toHaveProperty('response');
            
      //       // Verify task structure matches expected format
      //       const task = response.body.response;
      //       expect(task).toHaveProperty('id', 1);
      //       expect(task).toHaveProperty('cost', '1000');
      //       expect(task).toHaveProperty('complexity');
      //       expect(task.complexity).toHaveProperty('type', 'Days');
      //       expect(task.complexity).toHaveProperty('value', 5);
            
      //       console.info(`✅ Retrieved task #${task.id} information: ${task.complexity.type} (${task.complexity.value}), cost: ${task.cost}`);
      //     });

      //     it('should get team information', async () => {
      //       console.log('Getting team information...');
            
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_team`)
      //         .expect(200);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toBeDefined();
      //       expect(response.body).toHaveProperty('success', true);
      //       expect(response.body).toHaveProperty('response');
      //       expect(Array.isArray(response.body.response)).toBe(true);
      //       console.info(`✅ Retrieved team information: ${response.body.response.length} member(s)`);
      //     });

      //     it('should get scope information', async () => {
      //       console.log('Getting scope information...');
            
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_scope_info`)
      //         .expect(200);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toBeDefined();
      //       expect(response.body).toHaveProperty('success', true);
      //       expect(response.body).toHaveProperty('response');
      //       console.info('✅ Retrieved scope information');
      //     });

      //     it('should get task completion status', async () => {
      //       console.log('Getting task completion status...');
            
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_task_completion_status?task_id=1`)
      //         .expect(200);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toBeDefined();
      //       expect(response.body).toHaveProperty('success', true);
      //       expect(response.body).toHaveProperty('response');
      //       console.info('✅ Retrieved task #1 completion status');
      //     });
      //   });

      //   describe('Projects Module - Task Management', () => {
      //     it('should complete a task', async () => {
      //       console.log('Completing task 1...');
            
      //       expect(authToken).toBeDefined();
      //       expect(contractAddress).toBeDefined();

      //       const response = await request(app.getHttpServer())
      //         .post(`/projects/${contractAddress}/complete_task`)
      //         .set('Authorization', `Bearer ${authToken}`)
      //         .send({ task_id: 1 })
      //         .expect(201);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toHaveProperty('success');
      //       expect(response.body.success).toBe(true);
      //       console.info('✅ Completed task #1');
      //     });
      //   });

      //   describe('Projects Module - Project Completion', () => {
      //     it('should mark project as completed', async () => {
      //       console.log('Marking project as completed...');
            
      //       expect(authToken).toBeDefined();
      //       expect(contractAddress).toBeDefined();

      //       // First get team members to create ratings
      //       const teamResponse = await request(app.getHttpServer())
      //         .get(`/projects/${contractAddress}/get_team`)
      //         .expect(200);

      //       expect(teamResponse.body).toHaveProperty('success', true);
      //       const teamMembers = teamResponse.body.response;
            
      //       // Create ratings for each team member
      //       const ratings = teamMembers.map((member: any) => [member.account_id, 8]);

      //       const response = await request(app.getHttpServer())
      //         .post(`/projects/${contractAddress}/mark_completed`)
      //         .set('Authorization', `Bearer ${authToken}`)
      //         .send({ ratings })
      //         .expect(201);

      //       console.log('Response:', JSON.stringify(response.body, null, 2));

      //       expect(response.body).toHaveProperty('success');
      //       expect(response.body.success).toBe(true);
      //       console.log('Project marked as completed successfully');
      //       console.info(`✅ Marked project as completed with ${ratings.length} rating(s)`);
      //       console.info('\n✅ Developer team assembly and project execution completed successfully!\n');
      //     });
      //   });
      // });
    });
  });
});