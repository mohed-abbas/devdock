export type EnvironmentStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'stopped', 'starting', 'running', 'stopping', 'error',
]);

export function isValidEnvironmentStatus(value: string): value is EnvironmentStatus {
  return VALID_STATUSES.has(value);
}

export interface ComposeOptions {
  projectSlug: string;
  projectName: string;
  baseImage: string;
  hostUid: number;
  hostGid: number;
  enablePostgres: boolean;
  enableRedis: boolean;
  claudeConfigPath: string;   // Host path to ~/.claude, empty string if not set
  anthropicApiKey: string;     // ANTHROPIC_API_KEY value, empty string if not set
}

export interface DockerServiceResult {
  success: boolean;
  error?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  state: string; // 'running' | 'exited' | 'created' | 'paused' | etc.
  status: string; // human-readable like "Up 2 hours"
  service: string; // compose service name
}

export interface EnvironmentStatusResult {
  status: EnvironmentStatus;
  containers: ContainerInfo[];
  errorMessage?: string;
}
