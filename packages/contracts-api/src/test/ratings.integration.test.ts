import 'dotenv/config';
import { RatingsService } from '../ratings';
import { DeployService } from '../deployService';
import { alicePolkadotSigner, alicePublicAddress } from '../util/signer';
import { getPolkadotSigner } from 'polkadot-api/signer';
import { sr25519CreateDerive } from '@polkadot-labs/hdkd';
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Encode } from '@polkadot-labs/hdkd-helpers';

/**
 * Integration tests for Ratings Contract
 * 
 * These tests will:
 * 1. Deploy a fresh ratings contract before running tests
 * 2. Run all tests against the deployed contract
 * 3. The contract remains on the chain after tests complete
 * 
 * Requirements:
 * - A running node (Kreivo) on ws://localhost:21000 or set KREIVO_PROVIDER env var
 * - RATINGS_APP_ID environment variable set
 * - The signer must have funds and permissions to deploy contracts
 */

describe('RatingsService Integration Tests', () => {
  let ratingsService: RatingsService;
  let deployService: DeployService;
  let contractAddress: string;
  let testWorkerAddress: string;

  // Pre-deployed contract address (if available, deployment will be skipped)
  const PREDEFINED_CONTRACT_ADDRESS = 'DcxjGoA7UMoXk4FXKTQm7owXJ1QCsDruqQv1oovXuRM4ZaK';

  beforeAll(async () => {
    // Check if we should use predefined address or deploy new contract
    if (PREDEFINED_CONTRACT_ADDRESS) {
      contractAddress = PREDEFINED_CONTRACT_ADDRESS;
      console.log(`✅ Using predefined contract address: ${contractAddress}`);
    } else {
      console.log('🚀 Deploying ratings contract for integration tests...');
      
      // Initialize deploy service
      deployService = new DeployService();
      
      // Deploy ratings contract
      const deployConfig = deployService.getDeployConfigs().ratings_v5;
      const deployResult = await deployService.deployContract(deployConfig, {});
      
      if (!deployResult.success || !deployResult.address) {
        throw new Error(`Failed to deploy ratings contract: ${deployResult.error || 'Unknown error'}`);
      }
      
      contractAddress = deployResult.address;
      console.log(`✅ Ratings contract deployed at: ${contractAddress}`);
    }

    // Create test worker address from dev phrase
    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const seed = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(seed);
    
    // Generate test worker (Bob)
    const testWorker = derive('//Bob');
    testWorkerAddress = ss58Encode(testWorker.publicKey);

    // Initialize ratings service
    ratingsService = new RatingsService();
    await ratingsService.initialize();
    
    console.log('✅ RatingsService initialized and ready for tests');
    console.log('Test worker address:', testWorkerAddress);
  }, 120000); // 2 minutes timeout for deployment

  afterAll(async () => {
    if (ratingsService) {
      await ratingsService.destroy();
    }
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', () => {
      expect(ratingsService).toBeDefined();
    });

    test('should return available methods', () => {
      const methods = ratingsService.getAvailableMethods();
      expect(methods).toContain('register_worker');
      expect(methods).toContain('add_rating');
      expect(methods).toContain('get_worker_ratings');
      expect(methods).toContain('get_registered_workers');
      expect(methods).toContain('get_all_ratings');
    });

    test('should return available constructors', () => {
      const constructors = ratingsService.getAvailableConstructors();
      expect(constructors).toContain('new');
    });

    test('should validate existing methods', () => {
      expect(ratingsService.validateMethod('register_worker')).toBe(true);
      expect(ratingsService.validateMethod('add_rating')).toBe(true);
      expect(ratingsService.validateMethod('get_worker_ratings')).toBe(true);
      expect(ratingsService.validateMethod('nonexistent_method')).toBe(false);
    });

    test('should validate existing constructors', () => {
      expect(ratingsService.validateConstructor('new')).toBe(true);
      expect(ratingsService.validateConstructor('nonexistent')).toBe(false);
    });
  });

  // describe('Worker Registration - register_worker', () => {
  //   test('should register a worker', async () => {
  //     const result = await ratingsService.callMethod(
  //       contractAddress,
  //       'register_worker',
  //       { data: { worker: testWorkerAddress } }
  //     );

  //     expect(result).toHaveProperty('method', 'register_worker');
  //     expect(result).toHaveProperty('success');
  //     expect(result).toHaveProperty('transactionHash');
      
  //     console.log('✓ Worker registered:', testWorkerAddress);
  //   });
  // });

  // describe('Rating Management - add_rating', () => {
  //   test('should add a rating to worker', async () => {
  //     const result = await ratingsService.callMethod(
  //       contractAddress,
  //       'add_rating',
  //       { 
  //         data: {
  //           worker: testWorkerAddress,
  //           rating: 8
  //         }
  //       }
  //     );

  //     expect(result).toHaveProperty('method', 'add_rating');
  //     expect(result).toHaveProperty('success');
      
  //     console.log('✓ Rating added: 8/10');
  //   });
  // });

  describe('Query Methods - get_worker_ratings', () => {
    test('should query worker ratings', async () => {
      const result = await ratingsService.queryMethod(
        contractAddress,
        'get_worker_ratings',
        { worker: testWorkerAddress }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_worker_ratings');
      expect(result).toHaveProperty('contractAddress', contractAddress);
      expect(result).toHaveProperty('response');
      
      if (result.success) {
        console.log('✓ Worker ratings (array):', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });
  });

  describe('Query Methods - get_registered_workers', () => {
    test('should query all registered workers', async () => {
      const result = await ratingsService.queryMethod(
        contractAddress,
        'get_registered_workers',
        {}
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_registered_workers');
      expect(result).toHaveProperty('response');
      
      if (result.success) {
        console.log('✓ Registered workers:', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });
  });

  describe('Query Methods - get_all_ratings', () => {
    test('should query all ratings in the system', async () => {
      const result = await ratingsService.queryMethod(
        contractAddress,
        'get_all_ratings',
        {}
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_all_ratings');
      
      if (result.success) {
        console.log('✓ All ratings:', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });
  });
});

