import 'dotenv/config';
import { ProjectsService } from '../projects';
import { CalendarService } from '../calendar';
import { DeployService } from '../deployService';
import { alicePolkadotSigner, alicePublicAddress, charliePolkadotSigner, charliePublicAddress } from '../util/signer';
import { sr25519CreateDerive } from '@polkadot-labs/hdkd';
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Encode } from '@polkadot-labs/hdkd-helpers';
import { Binary, createClient } from 'polkadot-api';
import { request } from 'express';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { kreivo } from '@polkadot-api/descriptors';

/**
 * Integration tests for Projects Contract v5
 * 
 * These tests will:
 * 1. Use a predefined contract address or deploy a fresh contract
 * 2. Run all tests against the deployed contract
 * 3. The contract remains on the chain after tests complete
 * 
 * Requirements:
 * - A running node (Kreivo) on ws://localhost:21000 or set KREIVO_PROVIDER env var
 * - PROJECTS_APP_ID environment variable set
 * - The signer must have funds and permissions to deploy contracts
 */

describe('ProjectsService Integration Tests', () => {
  let projectsService: ProjectsService;
  let calendarService: CalendarService;
  let deployService: DeployService;
  let contractAddress: string;
  let calendarContractAddress: string;

  beforeAll(async () => {
      // Initialize deploy service
    deployService = new DeployService();

    // Step 1: Deploy calendar contract first
    console.log('Deploying calendar contract...');
    const calendarConfig = deployService.getDeployConfigs().calendar_v5;
    const calendarResult = await deployService.deployContract(calendarConfig, {});

    if (!calendarResult.success || !calendarResult.address) {
      throw new Error(`Failed to deploy calendar contract: ${calendarResult.error || 'Unknown error'}`);
    }

    calendarContractAddress = calendarResult.address;
    console.log(`Calendar contract deployed at: ${calendarContractAddress}`);

    // Step 2: Deploy projects contract with calendar address
    console.log('🚀 Deploying projects contract...');
    const deployConfig = deployService.getDeployConfigs().v5;
    const deployResult = await deployService.deployContract(deployConfig, {
      name: 'Test Project',
      dao_address: alicePublicAddress,
      calendar_contract: calendarContractAddress
    });

    if (!deployResult.success || !deployResult.address) {
      throw new Error(`Failed to deploy projects contract: ${deployResult.error || 'Unknown error'}`);
    }

    contractAddress = deployResult.address;
    console.log(`✅ Projects contract deployed at: ${contractAddress}`);

    // Initialize projects service
    projectsService = new ProjectsService();
    await projectsService.initialize();

    // Initialize calendar service
    calendarService = new CalendarService();
    await calendarService.initialize();

    console.log('✅ ProjectsService and CalendarService initialized and ready for tests');
  }, 240000); 

  afterAll(async () => {
    if (projectsService) {
      await projectsService.destroy();
    }
    if (calendarService) {
      await calendarService.destroy();
    }
  });

  describe('Query Methods - get_project_info', () => {
    test('should query project information', async () => {
      const result = await projectsService.queryMethod(
        contractAddress,
        'get_project_info',
        {}
      );

      expect(result.success).toBe(true);
      
      const projectName = result.response[0];
      expect(projectName).toBe('Test Project');

      console.log('✓ get_project_info result:', JSON.stringify(result.response, null, 2));
    });
  });

  describe('Calendar Setup - Worker Registration and Availability', () => {
    test('should register multiple workers in calendar contract', async () => {
      const result = await calendarService.callMethod(
        calendarContractAddress,
        'register_worker',
        { data: { worker: charliePublicAddress } }
      );

      expect(result.success).toBe(true);
      console.log('✓ register_worker encoded data:', result);
    });

    test('should set coordinator availability to FullTime as admin', async () => {
      const result = await calendarService.callMethod(
        calendarContractAddress,
        'admin_set_worker_availability',
        {
          data: { worker: charliePublicAddress, availability: { type: 'FullTime' } }
        }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);

      console.log('✓ admin_set_worker_availability (coordinator) encoded data:', result);
    });

    test('should verify coordinator availability is FullTime', async () => {
      const result = await calendarService.queryMethod(
        calendarContractAddress,
        'get_availability_hours',
        { worker: charliePublicAddress }
      );

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('method', 'get_availability_hours');

      if (result.success) {
        console.log(`✓ Coordinator availability hours:`, result.response);
        expect(typeof result.response === 'string' || typeof result.response === 'number').toBe(true);
      }
    });
  });

  describe('Coordinator Management - assign_coordinator', () => {
    test('should assign a coordinator to the project', async () => {
      const result = await projectsService.callMethod(
        contractAddress,
        'assign_coordinator',
        {}
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Projects Module - Assign Team', () => {
    it('should assign a team to the project', async () => {
      console.log('Assigning team to project...');

      const result = await projectsService.callMethod(
        contractAddress,
        'assign_team',
        { data: { ideal_team_size: 1 } },
      );
      console.log('Response:', JSON.stringify(result, null, 2));

      expect(result.encodedData).toBeDefined();

      const client = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:21000")),
      )
      const kreivoApi = client.getTypedApi(kreivo);
      const transaction = await kreivoApi.txFromCallData(Binary.fromHex(result.encodedData));

      const signedTransaction = await transaction.signAndSubmit(charliePolkadotSigner);
      console.log('Signed transaction:', signedTransaction);

      expect(signedTransaction.ok).toBe(true);

      console.log('Team assigned successfully');
    });
  });

  describe('Query Methods - get_team', () => {
    test('should query team members', async () => {
      const result = await projectsService.queryMethod(
        contractAddress,
        'get_team',
        {}
      );

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('method', 'get_team');

      if (result.success) {
        console.log('✓ Team members:', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });
  });

  describe('Scope Management - propose_scope', () => {
    test('should prepare callMethod data for proposing scope', async () => {
      const tasks = [
        [1, { type: 'Days', value: 5 }, 1000n, []]
      ];
      
      const documentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

      const result = await projectsService.callMethod(
        contractAddress,
        'propose_scope',
        { 
          data: {
            tasks,
            advance_payment_percentage: 20,
            document_hash: documentHash
          }
        }
      );

      expect(result.encodedData).toBeDefined();

      const client = createClient(
        withPolkadotSdkCompat(getWsProvider("ws://localhost:21000")),
      )
      const kreivoApi = client.getTypedApi(kreivo);
      const transaction = await kreivoApi.txFromCallData(Binary.fromHex(result.encodedData));

      const signedTransaction = await transaction.signAndSubmit(charliePolkadotSigner);
      console.log('Signed transaction:', signedTransaction);

      expect(signedTransaction.ok).toBe(true);
      
      console.log('✓ propose_scope encoded data:', result.encodedData);
    });
  });

  describe('Query Methods - get_scope_info', () => {
    test('should query scope information', async () => {
      const result = await projectsService.queryMethod(
        contractAddress,
        'get_scope_info',
        {}
      );

      expect(result.success).toBe(true);

      console.log('✓ Scope info:', result.response);
    });
  });

  describe('Query Methods - get_all_tasks', () => {
    test('should query all tasks', async () => {
      const result = await projectsService.queryMethod(
        contractAddress,
        'get_all_tasks',
        {}
      );

      expect(result.success).toBe(true);

      if (result.success) {
        console.log('✓ All tasks:', result.response);
        expect(Array.isArray(result.response)).toBe(true);

        const task = result.response[0];
        expect(task).toHaveProperty('id', 1);
        expect(task).toHaveProperty('cost', '1000');
        expect(task).toHaveProperty('complexity');
        expect(task.complexity).toHaveProperty('type', 'Days');
        expect(task.complexity).toHaveProperty('value', 5);
      } 
    });
  });

  describe('Query Methods - get_task', () => {
    test('should query specific task', async () => {
      const result = await projectsService.queryMethod(
        contractAddress,
        'get_task',
        { task_id: 1 }
      );

      expect(result.success).toBe(true);

      if (result.success) {
        const task = result.response;
        expect(task).toHaveProperty('id', 1);
        expect(task).toHaveProperty('cost', '1000');
        expect(task).toHaveProperty('complexity');
        expect(task.complexity).toHaveProperty('type', 'Days');
        expect(task.complexity).toHaveProperty('value', 5);
      }
      console.log('✓ Task details:', result.response);
    });
  });

  describe('Query Methods - get_task_completion_status', () => {
    test('should query task completion status', async () => {
      const result = await projectsService.queryMethod(
        contractAddress,
        'get_task_completion_status',
        { task_id: [1] }
      );

      expect(result.success).toBe(true);

      console.log('✓ Task completion status:', result.response);
    });
  });

  describe('Scope Approval - approve_scope', () => {
    test('should prepare callMethod data for approving scope', async () => {
      const approvedTaskIds = [1];
      
      const result = await projectsService.callMethod(
        contractAddress,
        'approve_scope',
        { data: { approved_task_ids: approvedTaskIds } }
      );

      expect(result.success).toBe(true);
      
      console.log('✓ approve_scope encoded data:', result.encodedData);
    });
  });

  describe('Task Management - complete_task', () => {
    test('should prepare callMethod data for completing a task', async () => {
      const result = await projectsService.callMethod(
        contractAddress,
        'complete_task',
        { task_id: 1 }
      );

      expect(result.success).toBe(true);

      console.log('✓ complete_task encoded data:', result);
    });
  });

  describe('Project Completion - mark_completed', () => {
    test('should prepare callMethod data for marking project as completed', async () => {
      const teamResult = await projectsService.queryMethod(
        contractAddress,
        'get_team',
        {}
      );

      expect(teamResult.success).toBe(true);

      const ratings = teamResult.response.map((member: any) => [member.account_id, 8]);
      console.log('✓ Ratings:', ratings);
      // const ratings = [
      //   ["5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", 8]
      // ];

      const result = await projectsService.callMethod(
        contractAddress,
        'mark_completed',
        { ratings }
      );

      expect(result.success).toBe(true);

      console.log('✓ mark_completed encoded data:', result);
    });
  });

  describe('Contract Address', () => {
    test('should log contract address', async () => {
      console.log('Contract address:', contractAddress);
      console.log('Calendar contract address:', calendarContractAddress);
    });
  });
});

