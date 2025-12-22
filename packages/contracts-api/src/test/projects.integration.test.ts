import 'dotenv/config';
import { ProjectsService } from '../projects';
import { ContractError } from '../util/contractError';
import { CalendarService } from '../calendar';
import { RatingsService } from '../ratings';
import { DeployService } from '../deployService';
import { adminPublicAddress, alicePolkadotSigner, alicePublicAddress, charliePolkadotSigner, charliePublicAddress } from './util/signer';
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
 * - PROJECTS_APP_ID, CALENDAR_APP_ID, RATINGS_APP_ID environment variables set
 * - The signer must have funds and permissions to deploy contracts
 */

describe('ProjectsService Integration Tests', () => {
  let projectsService: ProjectsService;
  let calendarService: CalendarService;
  let ratingsService: RatingsService;
  let deployService: DeployService;
  let contractAddress: string;
  let calendarContractAddress: string = 'Cfqrpkb3Fs17DBpQR5UmBq3bDzaDTnFe89RK9EwZvPWtJpr';
  let ratingsContractAddress: string = 'JEnwSomCEqPrh5HcEzPFNKVfrfoFjVLR6JVJvqKaTfba4zY';

  beforeAll(async () => {
    // Initialize deploy service
    deployService = new DeployService();

    // // Step 1: Deploy ratings contract first
    // console.log('🚀 Deploying ratings contract...');
    // const ratingsConfig = deployService.getDeployConfigs().ratings_v5;
    // const ratingsResult = await deployService.deployContract(ratingsConfig, {});

    // if (!ratingsResult.success || !ratingsResult.address) {
    //   throw new Error(`Failed to deploy ratings contract: ${ratingsResult.error || 'Unknown error'}`);
    // }

    // ratingsContractAddress = ratingsResult.address;
    // console.log(`✅ Ratings contract deployed at: ${ratingsContractAddress}`);

    // // Step 2: Deploy calendar contract with ratings address
    // console.log('🚀 Deploying calendar contract...');
    // const calendarConfig = deployService.getDeployConfigs().calendar_v5;
    // console.log('Calendar config:', calendarConfig);
    // const calendarResult = await deployService.deployContract(calendarConfig, {
    //   ratings_contract: ratingsContractAddress
    // });

    // if (!calendarResult.success || !calendarResult.address) {
    //   throw new Error(`Failed to deploy calendar contract: ${calendarResult.error || 'Unknown error'}`);
    // }

    // calendarContractAddress = calendarResult.address;
    // console.log(`✅ Calendar contract deployed at: ${calendarContractAddress}`);

    // Step 3: Deploy projects contract with calendar and ratings addresses
    // console.log('🚀 Deploying projects contract...');
    // const deployConfig = deployService.getDeployConfigs().v5;
    // const deployResult = await deployService.deployContract(deployConfig, {
    //   name: 'Test Project',
    //   dao_address: alicePublicAddress,
    //   // calendar_contract: calendarContractAddress,
    //   // ratings_contract: ratingsContractAddress
    // });

    // if (!deployResult.success || !deployResult.address) {
    //   throw new Error(`Failed to deploy projects contract: ${deployResult.error || 'Unknown error'}`);
    // }

    // contractAddress = deployResult.address;
    // console.log(`✅ Projects contract deployed at: ${contractAddress}`);
    contractAddress = 'GMjX1pxCNKaAccMQVDEt2nFjNHqvdgF7HRTphRCqEya8bGU';

    // Initialize services
    projectsService = new ProjectsService();
    await projectsService.initialize();

    calendarService = new CalendarService();
    await calendarService.initialize();

    // ratingsService = new RatingsService();
    // await ratingsService.initialize();

    console.log('✅ All services initialized and ready for tests');
  }, 240000);

  afterAll(async () => {
    if (projectsService) {
      await projectsService.destroy();
    }
    if (calendarService) {
      await calendarService.destroy();
    }
    // if (ratingsService) {
    //   await ratingsService.destroy();
    // }
  });

  // describe('Deployed Contract Addresse', () => {
  //   test('should deploy a project contract without dao address', async () => {
  //     const deployConfig = deployService.getDeployConfigs().v5;
  //     const deployResult = await deployService.deployContract(deployConfig, {
  //       name: 'Test Project without dao address',
  //     });

  //     expect(deployResult.success).toBe(true);
  //     expect(deployResult.address).toBeDefined();

  //     if (!deployResult.address) {
  //       throw new Error('Deploy result address is undefined');
  //     }

  //     const result = await projectsService.queryMethod(
  //       deployResult.address,
  //       'get_project_info',
  //       {}
  //     );

  //     expect(result.success).toBe(true);

  //     const projectName = result.response[0];
  //     expect(projectName).toBe('Test Project without dao address');

  //     const daoAddress = result.response[2];
  //     expect(daoAddress).toBe(adminPublicAddress);

  //     console.log('  - Projects contract:', deployResult.address);
  //   });

  //   test('should deploy a project contract with dao address', async () => {
  //     const deployConfig = deployService.getDeployConfigs().v5;
  //     const deployResult = await deployService.deployContract(deployConfig, {
  //       name: 'Test Project',
  //       dao_address: alicePublicAddress,
  //       // calendar_contract: calendarContractAddress,
  //       // ratings_contract: ratingsContractAddress
  //     });

  //     expect(deployResult.success).toBe(true);
  //     expect(deployResult.address).toBeDefined();
  //     console.log('  - Projects contract:', deployResult.address);
  //   });
  // });

  // describe('Query Methods - get_project_info', () => {
  //   test('should query project information', async () => {
  //     const result = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_project_info',
  //       {}
  //     );

  //     expect(result.success).toBe(true);

  //     const projectName = result.response[0];
  //     expect(projectName).toBe('Test Project');

  //     console.log('✓ get_project_info result:', JSON.stringify(result.response, null, 2));
  //   });
  // });

  // describe('Calendar Setup - Worker Registration and Availability', () => {
  //   test('should register multiple workers in calendar contract', async () => {
  //     const result = await calendarService.callMethod(
  //       calendarContractAddress,
  //       'register_worker',
  //       { data: { worker: charliePublicAddress } }
  //     );

  //     expect(result.success).toBe(true);
  //     console.log('✓ register_worker encoded data:', result);
  //   });

  //   test('should set coordinator availability to FullTime as admin', async () => {
  //     const result = await calendarService.callMethod(
  //       calendarContractAddress,
  //       'admin_set_worker_availability',
  //       {
  //         data: { worker: charliePublicAddress, availability: { type: 'FullTime' } }
  //       }
  //     );

  //     expect(result).toHaveProperty('success');
  //     expect(result.success).toBe(true);

  //     console.log('✓ admin_set_worker_availability (coordinator) encoded data:', result);
  //   });

  //   test('should verify coordinator availability is FullTime', async () => {
  //     const result = await calendarService.queryMethod(
  //       calendarContractAddress,
  //       'get_availability_hours',
  //       { worker: charliePublicAddress }
  //     );

  //     expect(result.success).toBe(true);
  //     expect(result).toHaveProperty('method', 'get_availability_hours');

  //     if (result.success) {
  //       console.log(`✓ Coordinator availability hours:`, result.response);
  //       expect(typeof result.response === 'string' || typeof result.response === 'number').toBe(true);
  //     }
  //   });
  // });

  // describe('Coordinator Management - assign_coordinator', () => {
  //   test('should assign a coordinator to the project', async () => {
  //     const result = await projectsService.callMethod(
  //       contractAddress,
  //       'assign_coordinator',
  //       {}
  //     );

  //     expect(result.success).toBe(true);
  //   });
  // });

  // describe('Projects Module - Assign Team', () => {
  //   it('should assign a team to the project', async () => {
  //     console.log('Assigning team to project...');

  //     const result = await projectsService.callMethod(
  //       contractAddress,
  //       'assign_team',
  //       { data: { ideal_team_size: 1 } },
  //     );
  //     console.log('Response:', JSON.stringify(result, null, 2));

  //     expect(result.encodedData).toBeDefined();

  //     const client = createClient(
  //       withPolkadotSdkCompat(getWsProvider("ws://localhost:21000")),
  //     )
  //     const kreivoApi = client.getTypedApi(kreivo);
  //     const transaction = await kreivoApi.txFromCallData(Binary.fromHex(result.encodedData));

  //     const signedTransaction = await transaction.signAndSubmit(charliePolkadotSigner);
  //     console.log('Signed transaction:', signedTransaction);

  //     expect(signedTransaction.ok).toBe(true);

  //     console.log('Team assigned successfully');
  //   });
  // });

  // describe('Query Methods - get_team', () => {
  //   test('should query team members', async () => {
  //     const result = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_team',
  //       {}
  //     );

  //     expect(result.success).toBe(true);
  //     expect(result).toHaveProperty('method', 'get_team');

  //     if (result.success) {
  //       console.log('✓ Team members:', result.response);
  //       expect(Array.isArray(result.response)).toBe(true);
  //     }
  //   });
  // });

  // describe('Scope Management - propose_scope', () => {
  //   test('should prepare callMethod data for proposing scope', async () => {
  //     const tasks = [
  //       [1, { type: 'Days', value: 5 }, 1000n, []]
  //     ];

  //     const documentHash = 'KJASDFH...';

  //     const result = await projectsService.callMethod(
  //       contractAddress,
  //       'propose_scope',
  //       { 
  //         data: {
  //           tasks,
  //           advance_payment_percentage: 20,
  //           document_hash: documentHash
  //         }
  //       }
  //     );

  //     expect(result.encodedData).toBeDefined();

  //     const client = createClient(
  //       withPolkadotSdkCompat(getWsProvider("ws://localhost:21000")),
  //     )
  //     const kreivoApi = client.getTypedApi(kreivo);
  //     const transaction = await kreivoApi.txFromCallData(Binary.fromHex(result.encodedData));

  //     const signedTransaction = await transaction.signAndSubmit(charliePolkadotSigner);
  //     console.log('Signed transaction:', signedTransaction);

  //     expect(signedTransaction.ok).toBe(true);

  //     console.log('✓ propose_scope encoded data:', result.encodedData);
  //   });
  // });

  // describe('Query Methods - get_scope_info', () => {
  //   test('should query scope information', async () => {
  //     const result = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_scope_info',
  //       {}
  //     );

  //     expect(result.success).toBe(true);

  //     console.log('✓ Scope info:', result.response);
  //   });
  // });

  // describe('Query Methods - get_all_tasks', () => {
  //   test('should query all tasks', async () => {
  //     const result = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_all_tasks',
  //       {}
  //     );

  //     expect(result.success).toBe(true);

  //     if (result.success) {
  //       console.log('✓ All tasks:', result.response);
  //       expect(Array.isArray(result.response)).toBe(true);

  //       const task = result.response[0];
  //       expect(task).toHaveProperty('id', 1);
  //       expect(task).toHaveProperty('cost', '1000');
  //       expect(task).toHaveProperty('complexity');
  //       expect(task.complexity).toHaveProperty('type', 'Days');
  //       expect(task.complexity).toHaveProperty('value', 5);
  //     } 
  //   });
  // });

  // describe('Query Methods - get_task', () => {
  //   test('should query specific task', async () => {
  //     const result = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_task',
  //       { task_id: 1 }
  //     );

  //     expect(result.success).toBe(true);

  //     if (result.success) {
  //       const task = result.response;
  //       expect(task).toHaveProperty('id', 1);
  //       expect(task).toHaveProperty('cost', '1000');
  //       expect(task).toHaveProperty('complexity');
  //       expect(task.complexity).toHaveProperty('type', 'Days');
  //       expect(task.complexity).toHaveProperty('value', 5);
  //     }
  //     console.log('✓ Task details:', result.response);
  //   });
  // });

  // describe('Query Methods - get_task_completion_status', () => {
  //   test('should query task completion status', async () => {
  //     const result = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_task_completion_status',
  //       { task_id: [1] }
  //     );

  //     expect(result.success).toBe(true);

  //     console.log('✓ Task completion status:', result.response);
  //   });
  // });

  // describe('Scope Approval - approve_scope', () => {
  //   test('should prepare callMethod data for approving scope', async () => {
  //     const approvedTaskIds = [1];

  //     const result = await projectsService.callMethod(
  //       contractAddress,
  //       'approve_scope',
  //       { data: { approved_task_ids: approvedTaskIds } }
  //     );

  //     expect(result.success).toBe(true);

  //     console.log('✓ approve_scope encoded data:', result.encodedData);
  //   });
  // });

  // describe('Task Management - complete_task', () => {
  //   test('should prepare callMethod data for completing a task', async () => {
  //     const result = await projectsService.callMethod(
  //       contractAddress,
  //       'complete_task',
  //       { task_id: 1 }
  //     );

  //     expect(result.success).toBe(true);

  //     console.log('✓ complete_task encoded data:', result);
  //   });
  // });

  // describe('Project Completion - mark_completed', () => {
  //   test('should prepare callMethod data for marking project as completed', async () => {
  //     const teamResult = await projectsService.queryMethod(
  //       contractAddress,
  //       'get_team',
  //       {}
  //     );

  //     expect(teamResult.success).toBe(true);

  //     const ratings = teamResult.response.map((member: any) => [member.account_id, 8]);
  //     console.log('✓ Ratings:', ratings);
  //     // const ratings = [
  //     //   ["5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", 8]
  //     // ];

  //     const result = await projectsService.callMethod(
  //       contractAddress,
  //       'mark_completed',
  //       { ratings }
  //     );

  //     expect(result.success).toBe(true);

  //     console.log('✓ mark_completed encoded data:', result);
  //   });
  // });

  describe('Ratings Integration Tests', () => {
    // test('should query registered workers in ratings contract', async () => {
    //   const result = await ratingsService.queryMethod(
    //     ratingsContractAddress,
    //     'get_registered_workers',
    //     {}
    //   );

    //   expect(result.success).toBe(true);
    //   console.log('✓ Registered workers in ratings:', result.response);

    //   if (result.success && result.response) {
    //     expect(Array.isArray(result.response)).toBe(true);
    //   }
    // });

    // test('should query worker ratings', async () => {
    //   const result = await ratingsService.queryMethod(
    //     ratingsContractAddress,
    //     'get_worker_ratings',
    //     { worker: charliePublicAddress }
    //   );

    //   expect(result.success).toBe(true);
    //   console.log('✓ Worker ratings:', result.response);
    // });

    // test('should query all ratings', async () => {
    //   const result = await ratingsService.queryMethod(
    //     ratingsContractAddress,
    //     'get_all_ratings',
    //     {}
    //   );

    //   expect(result.success).toBe(true);
    //   console.log('✓ All ratings:', result.response);

    //   if (result.success && result.response) {
    //     expect(Array.isArray(result.response)).toBe(true);
    //   }
    // });
  });

  describe('Contract Addresses', () => {
    test('should log all contract addresses', async () => {
      console.log('📋 Contract Addresses:');
      console.log('  - Projects contract:', contractAddress);
      console.log('  - Calendar contract:', calendarContractAddress);
      console.log('  - Ratings contract:', ratingsContractAddress);
    });
  });

  describe('Error Handling Tests', () => {
    let contractAddress = 'CxFEcoMsw1aTVJLWhnsjWoUcTEmaXVbJw6ix2RHeET1Eqsi';

    beforeAll(async () => {
      // Deploy a fresh contract without scope
      const deployConfig = deployService.getDeployConfigs().v5;
      const deployResult = await deployService.deployContract(deployConfig, {
        name: 'Test Project No Scope',
        dao_address: adminPublicAddress,
      });

      expect(deployResult.success).toBe(true);
      expect(deployResult.address).toBeDefined();

      if (!deployResult.address) {
        throw new Error('Failed to deploy test contract');
      }

      contractAddress = deployResult.address;
    });

    describe('Query Method Error Handling', () => {
      test('should handle result null when querying non-existent task', async () => {
        const result = await projectsService.queryMethod(
          contractAddress,
          'get_task',
          { task_id: 999 }
        );

        console.log('📝 get_task result:', JSON.stringify(result, null, 2));

        expect(result.success).toBe(true); // Compare with true because the return in the contract is a Option<Task>
        expect(result.response).toBeNull(); // Verify response is null on error
      });

      test('should handle ScopeNotDefined error when getting tasks before scope is defined', async () => {
        await expect(
          projectsService.queryMethod(contractAddress, 'get_all_tasks', {})
        ).rejects.toMatchObject({
          name: 'ContractError',
          method: 'get_all_tasks',
          contractAddress: contractAddress,
          errorMessage: expect.stringContaining('ScopeNotDefined'),
          errorCode: expect.any(String)
        });
      });

      test('should handle error when getting task completion status without scope', async () => {
        await expect(
          projectsService.queryMethod(contractAddress, 'get_task_completion_status', { task_id: [999] })
        ).rejects.toMatchObject({
          name: 'ContractError',
          method: 'get_task_completion_status',
          contractAddress: contractAddress,
          errorMessage: expect.stringContaining('ScopeNotDefined'),
          errorCode: expect.any(String)
        });
      });
    });

    describe('Call Method Error Handling', () => {
      test('should handle CalendarContractNotSet error when assigning coordinator without calendar', async () => {
        await expect(
          projectsService.callMethod(contractAddress, 'assign_coordinator', {})
        ).rejects.toMatchObject({
          name: 'ContractError',
          method: 'assign_coordinator',
          contractAddress: contractAddress,
          errorMessage: expect.stringContaining('CalendarContractNotSet'),
          errorCode: expect.any(String)
        });
      });

      test('should handle CoordinatorNotAssigned error when assigning team before coordinator', async () => {
        await expect(
          projectsService.callMethod(contractAddress, 'assign_team', { data: { ideal_team_size: 2 } })
        ).rejects.toMatchObject({
          name: 'ContractError',
          method: 'assign_team',
          contractAddress: contractAddress,
          errorMessage: expect.stringContaining('CoordinatorNotAssigned'),
          errorCode: expect.any(String)
        });
      });
    });

    describe('Error Response Structure Validation', () => {
      test('should handle method validation errors', async () => {
        await expect(
          calendarService.queryMethod(
            contractAddress,
            'non_existent_method',
            {}
          )
        ).rejects.toMatchObject({
          message: expect.stringContaining('not found in contract')
        });
      });

      test('should list available methods on validation error', async () => {
        try {
          await projectsService.callMethod(
            contractAddress,
            'invalid_method_name',
            {}
          );

          fail('Expected method to throw error');
        } catch (error: any) {
          console.log('📝 Available methods error:', error.message);

          expect(error.message).toContain('Available methods');
          expect(error.message).toContain('assign_coordinator');
          expect(error.message).toContain('get_project_info');
        }
      });
    });
  });
});

