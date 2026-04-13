import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { rm } from 'fs/promises';
import path from 'path';
import Docker from 'dockerode';
import { config } from '@/lib/config';
import type {
  DockerServiceResult,
  ContainerInfo,
  EnvironmentStatusResult,
  EnvironmentStatus,
} from './types';

const execFile = promisify(execFileCb);
const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

/**
 * Start a Docker Compose project.
 * Uses execFile (NOT exec) to prevent shell injection (T-03-02).
 */
export async function composeUp(
  projectName: string,
  composePath: string,
): Promise<DockerServiceResult> {
  try {
    await execFile('docker', [
      'compose', '-p', projectName, '-f', composePath, 'up', '-d',
    ]);
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    const message = error.stderr || error.message;
    return { success: false, error: message.slice(0, 500) };
  }
}

/**
 * Stop a Docker Compose project (preserves volumes).
 * Uses execFile (NOT exec) to prevent shell injection (T-03-02).
 */
export async function composeStop(
  projectName: string,
  composePath: string,
): Promise<DockerServiceResult> {
  try {
    await execFile('docker', [
      'compose', '-p', projectName, '-f', composePath, 'stop',
    ]);
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    const message = error.stderr || error.message;
    return { success: false, error: message.slice(0, 500) };
  }
}

/**
 * Remove a Docker Compose project entirely (containers, networks, volumes).
 * Uses -v to remove named volumes (D-12 full cleanup).
 * Uses --remove-orphans to clean up orphaned containers.
 * Uses execFile (NOT exec) to prevent shell injection (T-03-02).
 */
export async function composeDown(
  projectName: string,
  composePath: string,
): Promise<DockerServiceResult> {
  try {
    await execFile('docker', [
      'compose', '-p', projectName, '-f', composePath, 'down', '-v', '--remove-orphans',
    ]);
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    const message = error.stderr || error.message;
    return { success: false, error: message.slice(0, 500) };
  }
}

/**
 * Get the status of all containers in a Docker Compose project.
 * Uses dockerode for container inspection (D-10).
 *
 * Status derivation:
 * - All running -> 'running'
 * - All exited with code 0 -> 'stopped'
 * - Any exited with non-zero code -> 'error'
 * - Mixed (some running, some not) -> 'starting' (partial startup)
 * - No containers -> 'stopped'
 */
export async function getProjectStatus(
  projectName: string,
): Promise<EnvironmentStatusResult> {
  const rawContainers = await docker.listContainers({
    all: true,
    filters: {
      label: [`com.docker.compose.project=${projectName}`],
    },
  });

  if (rawContainers.length === 0) {
    return { status: 'stopped', containers: [] };
  }

  const containers: ContainerInfo[] = rawContainers.map((c) => ({
    id: c.Id,
    name: c.Names[0]?.replace(/^\//, '') || '',
    state: c.State,
    status: c.Status,
    service: c.Labels['com.docker.compose.service'] || '',
  }));

  // Derive overall status
  const allRunning = containers.every((c) => c.state === 'running');
  if (allRunning) {
    return { status: 'running', containers };
  }

  // Check for error: any container exited with non-zero code
  const failedContainer = containers.find(
    (c) => c.state === 'exited' && !c.status.includes('(0)'),
  );
  if (failedContainer) {
    const errorMessage = `Container ${failedContainer.service} exited with error: ${failedContainer.status}`;
    return {
      status: 'error',
      containers,
      errorMessage: errorMessage.slice(0, 500),
    };
  }

  // All exited with code 0
  const allExitedClean = containers.every(
    (c) => c.state === 'exited' && c.status.includes('(0)'),
  );
  if (allExitedClean) {
    return { status: 'stopped', containers };
  }

  // Mixed state - partial startup
  return { status: 'starting' as EnvironmentStatus, containers };
}

/**
 * Clone a Git repository into the target directory.
 * Shallow clone (--depth 1) for speed.
 * Uses execFile (NOT exec) to prevent shell injection (T-03-02).
 */
export async function cloneRepo(
  repoUrl: string,
  targetDir: string,
): Promise<DockerServiceResult> {
  try {
    await execFile('git', ['clone', '--depth', '1', repoUrl, targetDir]);
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    const message = error.stderr || error.message;
    return { success: false, error: message.slice(0, 500) };
  }
}

/**
 * Remove the data directory for an environment.
 * Per D-12, full cleanup includes removing the data directory.
 */
export async function removeDataDir(envSlug: string): Promise<void> {
  await rm(path.join(config.DEVDOCK_DATA_DIR, envSlug), {
    recursive: true,
    force: true,
  });
}

/**
 * Create an interactive exec session inside a container.
 * Uses PTY for full terminal emulation (D-03, TERM-01).
 * Runs as 'dev' user per D-03.
 * IMPORTANT: With Tty: true, stdout/stderr are multiplexed into a single
 * raw stream. Do NOT use docker.modem.demuxStream() (Pitfall 1).
 */
export async function createExecSession(
  containerId: string,
  cols: number,
  rows: number,
): Promise<{ execId: string; stream: NodeJS.ReadWriteStream }> {
  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: ['/bin/bash'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    User: 'dev',
    Env: ['TERM=xterm-256color'],
  });

  const stream = await exec.start({
    hijack: true,
    stdin: true,
    Tty: true,
  });

  return { execId: exec.id, stream: stream as unknown as NodeJS.ReadWriteStream };
}

/**
 * Resize the PTY of an exec session.
 * Debounce on the client side (100-150ms) before calling (Pitfall 3).
 */
export async function resizeExec(
  execId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const exec = docker.getExec(execId);
  await exec.resize({ h: rows, w: cols });
}

/**
 * Find the dev container ID for a Docker Compose project.
 * Uses the com.docker.compose.service=dev label (Pitfall 7).
 */
export async function findDevContainerId(
  projectName: string,
): Promise<string | null> {
  const containers = await docker.listContainers({
    filters: {
      label: [
        `com.docker.compose.project=${projectName}`,
        'com.docker.compose.service=dev',
      ],
    },
  });

  if (containers.length === 0) return null;
  return containers[0].Id;
}
