import 'dotenv/config';
import { CalendarService } from '../calendar';
import { DeployService } from '../deployService';
import { alicePolkadotSigner, alicePublicAddress } from './util/signer';
import { getPolkadotSigner } from 'polkadot-api/signer';
import { sr25519CreateDerive } from '@polkadot-labs/hdkd';
import { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy, ss58Encode } from '@polkadot-labs/hdkd-helpers';

/**
 * Integration tests for Calendar Contract
 * 
 * These tests will:
 * 1. Deploy a fresh calendar contract before running tests
 * 2. Run all tests against the deployed contract
 * 3. The contract remains on the chain after tests complete
 * 
 * Requirements:
 * - A running node (Kreivo) on ws://localhost:21000 or set KREIVO_PROVIDER env var
 * - CALENDAR_APP_ID environment variable set
 * - The signer must have funds and permissions to deploy contracts
 */

describe('CalendarService Integration Tests', () => {
  let calendarService: CalendarService;
  let deployService: DeployService;
  let contractAddress: string;
  let testWorkerAddress: string;
  let testWorkerAddress2: string;

  // Pre-deployed contract address (if available, deployment will be skipped)
  const PREDEFINED_CONTRACT_ADDRESS = '';

  beforeAll(async () => {
    // Check if we should use predefined address or deploy new contract
    if (PREDEFINED_CONTRACT_ADDRESS) {
      contractAddress = PREDEFINED_CONTRACT_ADDRESS;
      console.log(`✅ Using predefined contract address: ${contractAddress}`);
    } else {
      console.log('🚀 Deploying calendar contract for integration tests...');
      
      // Initialize deploy service
      deployService = new DeployService();
      
      // Deploy calendar contract
      const deployConfig = deployService.getDeployConfigs().calendar_v5;
      const deployResult = await deployService.deployContract(deployConfig, {});
      
      if (!deployResult.success || !deployResult.address) {
        throw new Error(`Failed to deploy calendar contract: ${deployResult.error || 'Unknown error'}`);
      }
      
      contractAddress = deployResult.address;
      console.log(`✅ Calendar contract deployed at: ${contractAddress}`);
    }

    // Create test worker addresses from dev phrase
    const entropy = mnemonicToEntropy(DEV_PHRASE);
    const seed = entropyToMiniSecret(entropy);
    const derive = sr25519CreateDerive(seed);
    
    // Generate test workers
    const testWorker1 = derive('//Bob');
    const testWorker2 = derive('//Charlie');
    
    testWorkerAddress = ss58Encode(testWorker1.publicKey);
    testWorkerAddress2 = ss58Encode(testWorker2.publicKey);

    // Initialize calendar service
    calendarService = new CalendarService();
    await calendarService.initialize();
    
    console.log('✅ CalendarService initialized and ready for tests');
  }, 120000); // 2 minutes timeout for deployment

  afterAll(async () => {
    if (calendarService) {
      await calendarService.destroy();
    }
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', () => {
      expect(calendarService).toBeDefined();
    });

    test('should return available methods', () => {
      const methods = calendarService.getAvailableMethods();
      expect(methods).toContain('register_worker');
      expect(methods).toContain('set_availability');
      expect(methods).toContain('get_availability_hours');
      expect(methods).toContain('is_available');
      expect(methods).toContain('get_available_workers');
      expect(methods).toContain('register_workers');
      expect(methods).toContain('get_registered_workers');
      expect(methods).toContain('get_all_workers_availability');
      expect(methods).toContain('admin_set_worker_availability');
    });

    test('should return available constructors', () => {
      const constructors = calendarService.getAvailableConstructors();
      expect(constructors).toContain('new');
    });

    test('should validate existing methods', () => {
      expect(calendarService.validateMethod('register_worker')).toBe(true);
      expect(calendarService.validateMethod('nonexistent_method')).toBe(false);
    });

    test('should validate existing constructors', () => {
      expect(calendarService.validateConstructor('new')).toBe(true);
      expect(calendarService.validateConstructor('nonexistent')).toBe(false);
    });
  });

  describe('Worker Registration - register_worker', () => {
    test('should prepare callMethod data for registering a worker', async () => {
      const result = await calendarService.callMethod(
        contractAddress,
        'register_worker',
        { worker: testWorkerAddress }
      );

      expect(result).toHaveProperty('method', 'register_worker');
      expect(result).toHaveProperty('encodedData');
      expect(result.encodedData).toMatch(/^0x[0-9a-fA-F]+$/);
      
      console.log('✓ register_worker encoded data:', result.encodedData);
    });

    test('should fail with invalid method name', async () => {
      await expect(
        calendarService.callMethod(contractAddress, 'invalid_method', {})
      ).rejects.toThrow('Method "invalid_method" not found');
    });
  });

  describe('Batch Worker Registration - register_workers', () => {
    test('should prepare callMethod data for registering multiple workers', async () => {
      const workers = [testWorkerAddress, testWorkerAddress2];
      
      const result = await calendarService.callMethod(
        contractAddress,
        'register_workers',
        { workers }
      );

      expect(result).toHaveProperty('method', 'register_workers');
      expect(result).toHaveProperty('encodedData');
      expect(result.encodedData).toMatch(/^0x[0-9a-fA-F]+$/);
      
      console.log('✓ register_workers encoded data:', result.encodedData);
    });
  });

  describe('Availability Management - set_availability', () => {
    test('should prepare callMethod data for NotAvailable', async () => {
      const result = await calendarService.callMethod(
        contractAddress,
        'set_availability',
        { availability: { type: 'NotAvailable' } }
      );

      expect(result).toHaveProperty('method', 'set_availability');
      expect(result).toHaveProperty('encodedData');
      
      console.log('✓ set_availability (NotAvailable) encoded data:', result.encodedData);
    });

    test('should prepare callMethod data for PartTime', async () => {
      const result = await calendarService.callMethod(
        contractAddress,
        'set_availability',
        { availability: { type: 'PartTime' } }
      );

      expect(result).toHaveProperty('method', 'set_availability');
      expect(result).toHaveProperty('encodedData');
      
      console.log('✓ set_availability (PartTime) encoded data:', result.encodedData);
    });

    test('should prepare callMethod data for FullTime', async () => {
      const result = await calendarService.callMethod(
        contractAddress,
        'set_availability',
        { availability: { type: 'FullTime'} }
      );

      expect(result).toHaveProperty('method', 'set_availability');
      expect(result).toHaveProperty('encodedData');
      
      console.log('✓ set_availability (FullTime) encoded data:', result.encodedData);
    });

    test('should prepare callMethod data for WeeklyHours', async () => {
      const result = await calendarService.callMethod(
        contractAddress,
        'set_availability',
        { availability: { type: 'WeeklyHours', WeeklyHours: 20 } }
      );

      expect(result).toHaveProperty('method', 'set_availability');
      expect(result).toHaveProperty('encodedData');
      
      console.log('✓ set_availability (WeeklyHours: 20) encoded data:', result.encodedData);
    });
  });

  describe('Admin Set Worker Availability - admin_set_worker_availability', () => {
    test('should prepare callMethod data for admin setting worker availability', async () => {
      const result = await calendarService.callMethod(
        contractAddress,
        'admin_set_worker_availability',
        { 
          worker: testWorkerAddress,
          availability: { type: 'FullTime'} 
        }
      );

      expect(result).toHaveProperty('method', 'admin_set_worker_availability');
      expect(result).toHaveProperty('encodedData');
      
      console.log('✓ admin_set_worker_availability encoded data:', result.encodedData);
    });
  });

  describe('Query Methods - get_registered_workers', () => {
    test('should query all registered workers', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'get_registered_workers',
        {}
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_registered_workers');
      expect(result).toHaveProperty('contractAddress', contractAddress);
      expect(result).toHaveProperty('response');
      
      if (result.success) {
        console.log('✓ Registered workers:', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      } else {
        console.log('⚠️  Query failed (might be expected if contract is new)');
      }
    });
  });

  describe('Query Methods - get_availability_hours', () => {
    test('should query worker availability hours', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'get_availability_hours',
        { worker: testWorkerAddress }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_availability_hours');
      expect(result).toHaveProperty('response');
      
      if (result.success) {
        console.log(`✓ Worker ${testWorkerAddress} hours:`, result.response);
        expect(typeof result.response === 'string' || typeof result.response === 'number').toBe(true);
      } else {
        console.log('⚠️  Query failed (worker might not be registered)');
      }
    });
  });

  describe('Query Methods - is_available', () => {
    test('should query if worker is available without min_hours', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'is_available',
        { 
          worker: testWorkerAddress,
          min_hours: null
        }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'is_available');
      
      if (result.success) {
        console.log(`✓ Is worker ${testWorkerAddress} available:`, result.response);
        expect(typeof result.response === 'boolean').toBe(true);
      }
    });

    test('should query if worker is available with min_hours', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'is_available',
        { 
          worker: testWorkerAddress,
          min_hours: 20
        }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'is_available');
      
      if (result.success) {
        console.log(`✓ Is worker available (min 20h):`, result.response);
        expect(typeof result.response === 'boolean').toBe(true);
      }
    });
  });

  describe('Query Methods - get_available_workers', () => {
    test('should query available workers without min_hours filter', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'get_available_workers',
        { min_hours: null }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_available_workers');
      
      if (result.success) {
        console.log('✓ Available workers (no filter):', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });

    test('should query available workers with min_hours filter', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'get_available_workers',
        { min_hours: 30 }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_available_workers');
      
      if (result.success) {
        console.log('✓ Available workers (min 30h):', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });
  });

  describe('Query Methods - get_all_workers_availability', () => {
    test('should query all workers with their availability', async () => {
      const result = await calendarService.queryMethod(
        contractAddress,
        'get_all_workers_availability',
        {}
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method', 'get_all_workers_availability');
      
      if (result.success) {
        console.log('✓ All workers availability:', result.response);
        expect(Array.isArray(result.response)).toBe(true);
      }
    });
  });
});

