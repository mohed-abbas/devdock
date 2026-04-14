import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they're available in vi.mock factories
const { mockExecFile, mockListContainers, mockRm } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockListContainers: vi.fn(),
  mockRm: vi.fn(),
}));

// Mock child_process - must be callback-compatible for promisify
vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

// Mock dockerode - needs to be a constructor (class)
vi.mock('dockerode', () => {
  return {
    default: class MockDocker {
      listContainers = mockListContainers;
    },
  };
});

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    DOCKER_SOCKET: '/var/run/docker.sock',
    DEVDOCK_DATA_DIR: '/tmp/devdock-data',
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  rm: mockRm,
}));

// Import after mocks are set up - module-level initialization uses mocks
import {
  composeUp,
  composeStop,
  composeDown,
  getProjectStatus,
  cloneRepo,
  removeDataDir,
} from '../docker-service';

describe('Docker service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make execFile behave like callback-based fn for promisify
    mockExecFile.mockImplementation(
      (cmd: string, args: string[], callback: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
        callback(null, { stdout: '', stderr: '' });
      }
    );
    mockRm.mockResolvedValue(undefined);
    mockListContainers.mockResolvedValue([]);
  });

  describe('composeUp', () => {
    it('calls execFile with compose up -d arguments', async () => {
      const result = await composeUp('devdock-test', '/data/test/docker-compose.yml');

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['compose', '-p', 'devdock-test', '-f', '/data/test/docker-compose.yml', 'up', '-d'],
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('returns error result when execFile fails', async () => {
      mockExecFile.mockImplementation(
        (cmd: string, args: string[], callback: (err: Error | null) => void) => {
          const error = new Error('Docker compose failed') as Error & { stderr: string };
          error.stderr = 'container startup failed';
          callback(error);
        }
      );

      const result = await composeUp('devdock-test', '/data/test/docker-compose.yml');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('composeStop', () => {
    it('calls execFile with compose stop arguments', async () => {
      const result = await composeStop('devdock-test', '/data/test/docker-compose.yml');

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['compose', '-p', 'devdock-test', '-f', '/data/test/docker-compose.yml', 'stop'],
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('composeDown', () => {
    it('calls execFile with compose down -v --remove-orphans arguments', async () => {
      const result = await composeDown('devdock-test', '/data/test/docker-compose.yml');

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['compose', '-p', 'devdock-test', '-f', '/data/test/docker-compose.yml', 'down', '-v', '--remove-orphans'],
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getProjectStatus', () => {
    it('returns running when all containers are running', async () => {
      mockListContainers.mockResolvedValue([
        {
          Id: 'abc123',
          Names: ['/devdock-test-dev'],
          State: 'running',
          Status: 'Up 2 hours',
          Labels: {
            'com.docker.compose.service': 'dev',
            'com.docker.compose.project': 'devdock-test',
          },
        },
        {
          Id: 'def456',
          Names: ['/devdock-test-postgres'],
          State: 'running',
          Status: 'Up 2 hours',
          Labels: {
            'com.docker.compose.service': 'postgres',
            'com.docker.compose.project': 'devdock-test',
          },
        },
      ]);

      const result = await getProjectStatus('devdock-test');

      expect(result.status).toBe('running');
      expect(result.containers).toHaveLength(2);
      expect(result.containers[0].service).toBe('dev');
      expect(result.containers[1].service).toBe('postgres');
    });

    it('returns stopped when containers are exited with code 0', async () => {
      mockListContainers.mockResolvedValue([
        {
          Id: 'abc123',
          Names: ['/devdock-test-dev'],
          State: 'exited',
          Status: 'Exited (0) 5 minutes ago',
          Labels: {
            'com.docker.compose.service': 'dev',
            'com.docker.compose.project': 'devdock-test',
          },
        },
      ]);

      const result = await getProjectStatus('devdock-test');

      expect(result.status).toBe('stopped');
    });

    it('returns error with errorMessage when container exited with non-zero code', async () => {
      mockListContainers.mockResolvedValue([
        {
          Id: 'abc123',
          Names: ['/devdock-test-dev'],
          State: 'exited',
          Status: 'Exited (1) 2 minutes ago',
          Labels: {
            'com.docker.compose.service': 'dev',
            'com.docker.compose.project': 'devdock-test',
          },
        },
      ]);

      const result = await getProjectStatus('devdock-test');

      expect(result.status).toBe('error');
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage).toContain('dev');
    });

    it('returns stopped when no containers exist for the project', async () => {
      mockListContainers.mockResolvedValue([]);

      const result = await getProjectStatus('devdock-test');

      expect(result.status).toBe('stopped');
      expect(result.containers).toHaveLength(0);
    });
  });

  describe('cloneRepo', () => {
    it('calls execFile with git clone arguments', async () => {
      const result = await cloneRepo('https://github.com/user/repo.git', '/data/test/workspace');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', 'https://github.com/user/repo.git', '/data/test/workspace'],
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('clone with token builds authenticated URL using x-access-token', async () => {
      const result = await cloneRepo('https://github.com/user/repo', '/tmp/target', undefined, 'ghp_test123');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', 'https://x-access-token:ghp_test123@github.com/user/repo', '/tmp/target'],
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('clone with branch includes --branch flag', async () => {
      const result = await cloneRepo('https://github.com/user/repo', '/tmp/target', 'develop');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--branch', 'develop', 'https://github.com/user/repo', '/tmp/target'],
        expect.any(Function)
      );
      expect(result).toEqual({ success: true });
    });

    it('clone with both branch and token passes both correctly', async () => {
      await cloneRepo('https://github.com/user/repo', '/tmp/target', 'main', 'ghp_abc');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--branch', 'main', 'https://x-access-token:ghp_abc@github.com/user/repo', '/tmp/target'],
        expect.any(Function)
      );
    });

    it('does not embed token for non-GitHub URLs', async () => {
      await cloneRepo('https://gitlab.com/user/repo', '/tmp/target', undefined, 'ghp_test');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', 'https://gitlab.com/user/repo', '/tmp/target'],
        expect.any(Function)
      );
    });

    it('sanitize token from error messages on clone failure', async () => {
      const secretToken = 'ghp_supersecrettoken123';
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], callback: (err: Error | null) => void) => {
          const error = new Error('Command failed') as Error & { stderr: string };
          error.stderr = `fatal: Authentication failed for 'https://x-access-token:${secretToken}@github.com/user/repo'`;
          callback(error);
        }
      );

      const result = await cloneRepo('https://github.com/user/repo', '/tmp/target', undefined, secretToken);

      expect(result.success).toBe(false);
      expect(result.error).not.toContain(secretToken);
      expect(result.error).toContain('***');
    });

    it('truncates error messages to 500 characters', async () => {
      const longError = 'x'.repeat(1000);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], callback: (err: Error | null) => void) => {
          const error = new Error('Command failed') as Error & { stderr: string };
          error.stderr = longError;
          callback(error);
        }
      );

      const result = await cloneRepo('https://github.com/user/repo', '/tmp/target');

      expect(result.success).toBe(false);
      expect(result.error!.length).toBeLessThanOrEqual(500);
    });
  });

  describe('removeDataDir', () => {
    it('removes the environment data directory', async () => {
      await removeDataDir('test-env');

      expect(mockRm).toHaveBeenCalledWith(
        '/tmp/devdock-data/test-env',
        { recursive: true, force: true }
      );
    });
  });
});
