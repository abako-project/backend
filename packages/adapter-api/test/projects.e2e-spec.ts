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
  let userAccountId: string = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
  let contractAddress: string;
  let workerAccountId: string;
  let calendarContractAddress: string;

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
    userId = `test-projects-user-${Date.now()}@example.com`;

    console.log('Application started successfully');
    console.log('Client SDK initialized');
    console.log(`Test user: ${userId}`);
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
            id: userId,
            name: 'Projects Test User',
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
        
        console.info(`✅ Registered new user: ${userId.substring(0, 20)}...`);
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

        console.info(`✅ Connected user and obtained authentication token ${authToken.substring(0, 20)}...`);
      });
    });

    describe('📝 Listings & Developer Matching', () => {
      describe('Submitting a project proposal as a client', () => {
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

            console.info(`✅ Deployed calendar contract at: ${calendarContractAddress.substring(0, 20)}...`);
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
            console.info(`✅ Registered worker ${workerAccountId.substring(0, 20)}... in calendar`);
          });
        });

        describe('Calendar - Set Availability ', () => {
          it('should set availability', async () => {
            console.log('Attempting set_availability...');

            expect(authToken).toBeDefined();
            expect(calendarContractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/calendar/${calendarContractAddress}/set_availability`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ availability: { WeeklyHours: 40 } });

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success', true);
            console.info('✅ Set availability: 40 weekly hours');
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
            console.info('✅ Set availability: 40 weekly hours for worker: ${workerAccountId}');
          });

        });

        describe('Projects Module - Deploy Contract', () => {
          it('should deploy a new project contract', async () => {
            console.log('Deploying project contract...');

            const deployData = {
              name: 'Test Project',
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
            console.info(`✅ Deployed project contract "${deployData.name}" at: ${contractAddress.substring(0, 20)}...`);
          });
        });
      });

      describe('Running algorithm: Assigning coordinator', () => {
        describe('Projects Module - Assign Coordinator', () => {
          it('should assign coordinator to project', async () => {
            console.log('Assigning coordinator to project...');
    
            expect(authToken).toBeDefined();
            expect(contractAddress).toBeDefined();
    
            const response = await request(app.getHttpServer())
              .post(`/projects/${contractAddress}/assign_coordinator`)
              .send({ })
              .set('Authorization', `Bearer ${authToken}`)
              .expect(201);
    
            console.log('Response:', JSON.stringify(response.body, null, 2));
    
            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.log('Coordinator assigned successfully');
            console.info(`✅ Assigned coordinator to project ${contractAddress.substring(0, 20)}...`);
          });
        });
      });

      describe('Assembling developer team', () => {
        describe('Projects Module - Assign Team', () => {
          it('should assign a team to the project', async () => {
            console.log('Assigning team to project...');
            
            expect(authToken).toBeDefined();
            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/projects/${contractAddress}/assign_team`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ideal_team_size: 1})
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.info(`✅ Assigned team (ideal size: 1) to project ${contractAddress.substring(0, 20)}...`);
          });
        });

        describe('Projects Module - Propose Scope', () => {
          it('should propose a scope with tasks', async () => {
            console.log('Proposing scope with tasks...');
            
            const scopeData = {
              tasks: [
                [1, { type: 'Days', value: 5 }, 1000, []]
              ],
              advance_payment_percentage: 20,
              document_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            };

            expect(authToken).toBeDefined();
            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/projects/${contractAddress}/propose_scope`)
              .set('Authorization', `Bearer ${authToken}`)
              .send(scopeData)
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.info(`✅ Proposed scope with ${scopeData.tasks.length} task(s) (advance: ${scopeData.advance_payment_percentage}%)`);
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
              .send({ approved_task_ids: [1] })
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            const approvedTasks = [1];
            console.info(`✅ Approved scope with ${approvedTasks.length} task(s): [${approvedTasks.join(', ')}]`);
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
            
            // Verify project name matches what was deployed
            const projectName = response.body.response[0];
            expect(projectName).toBe('Test Project');
            
            console.info(`✅ Retrieved project information: "${projectName}"`);
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
            expect(response.body.response.length).toBeGreaterThanOrEqual(1);
            
            // Verify task structure matches expected format
            const task = response.body.response[0];
            expect(task).toHaveProperty('id', 1);
            expect(task).toHaveProperty('cost', '1000');
            expect(task).toHaveProperty('complexity');
            expect(task.complexity).toHaveProperty('type', 'Days');
            expect(task.complexity).toHaveProperty('value', 5);
            
            console.info(`✅ Retrieved all tasks: ${response.body.response.length} task(s) found`);
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
            
            // Verify task structure matches expected format
            const task = response.body.response;
            expect(task).toHaveProperty('id', 1);
            expect(task).toHaveProperty('cost', '1000');
            expect(task).toHaveProperty('complexity');
            expect(task.complexity).toHaveProperty('type', 'Days');
            expect(task.complexity).toHaveProperty('value', 5);
            
            console.info(`✅ Retrieved task #${task.id} information: ${task.complexity.type} (${task.complexity.value}), cost: ${task.cost}`);
          });

          it('should get team information', async () => {
            console.log('Getting team information...');
            
            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}/get_team`)
              .expect(200);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toBeDefined();
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('response');
            expect(Array.isArray(response.body.response)).toBe(true);
            console.info(`✅ Retrieved team information: ${response.body.response.length} member(s)`);
          });

          it('should get scope information', async () => {
            console.log('Getting scope information...');
            
            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}/get_scope_info`)
              .expect(200);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toBeDefined();
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('response');
            console.info('✅ Retrieved scope information');
          });

          it('should get task completion status', async () => {
            console.log('Getting task completion status...');
            
            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}/get_task_completion_status?task_id=1`)
              .expect(200);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toBeDefined();
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('response');
            console.info('✅ Retrieved task #1 completion status');
          });
        });

        describe('Projects Module - Task Management', () => {
          it('should complete a task', async () => {
            console.log('Completing task 1...');
            
            expect(authToken).toBeDefined();
            expect(contractAddress).toBeDefined();

            const response = await request(app.getHttpServer())
              .post(`/projects/${contractAddress}/complete_task`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ task_id: 1 })
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.info('✅ Completed task #1');
          });
        });

        describe('Projects Module - Project Completion', () => {
          it('should mark project as completed', async () => {
            console.log('Marking project as completed...');
            
            expect(authToken).toBeDefined();
            expect(contractAddress).toBeDefined();

            // First get team members to create ratings
            const teamResponse = await request(app.getHttpServer())
              .get(`/projects/${contractAddress}/get_team`)
              .expect(200);

            expect(teamResponse.body).toHaveProperty('success', true);
            const teamMembers = teamResponse.body.response;
            
            // Create ratings for each team member
            const ratings = teamMembers.map((member: any) => [member.account_id, 8]);

            const response = await request(app.getHttpServer())
              .post(`/projects/${contractAddress}/mark_completed`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ ratings })
              .expect(201);

            console.log('Response:', JSON.stringify(response.body, null, 2));

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            console.log('Project marked as completed successfully');
            console.info(`✅ Marked project as completed with ${ratings.length} rating(s)`);
            console.info('\n✅ Developer team assembly and project execution completed successfully!\n');
          });
        });
      });
    });
  });
});