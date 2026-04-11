import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import type { ComposeOptions } from '../types';
import { generateComposeFile } from '../compose-generator';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Template content matching actual docker/templates/base-compose.yml
const TEMPLATE_CONTENT = `# docker/templates/base-compose.yml
# Template for new project environments
# Variables (replaced at generation time):
#   {{PROJECT_SLUG}} - URL-safe project identifier
#   {{PROJECT_NAME}} - Human-readable project name
#   {{BASE_IMAGE}} - devdock-base:latest or custom image
#   {{HOST_UID}} - Host user UID for permission matching
#   {{HOST_GID}} - Host user GID for permission matching

services:
  dev:
    image: "{{BASE_IMAGE}}"
    container_name: "devdock-{{PROJECT_SLUG}}-dev"
    build:
      context: ../../base
      args:
        HOST_UID: "{{HOST_UID}}"
        HOST_GID: "{{HOST_GID}}"
    volumes:
      - ./workspace:/workspace
      # Claude config mounted read-only per Pitfall #5
      # Path resolved at generation time
      # - \${HOME}/.claude:/home/dev/.claude:ro
    working_dir: /workspace
    networks:
      - project-net
    # No ports published to host (INFRA-05)
    # mem_limit / cpus added by Phase 7 resource management (D-18)
    # Docker socket is NEVER mounted here (INFRA-04)
    restart: unless-stopped

  # Optional sidecar: PostgreSQL (INFRA-01)
  # Uncomment when project needs a database
  # postgres:
  #   image: postgres:16
  #   container_name: "devdock-{{PROJECT_SLUG}}-postgres"
  #   environment:
  #     POSTGRES_DB: "{{PROJECT_SLUG}}"
  #     POSTGRES_USER: dev
  #     POSTGRES_PASSWORD: devpassword
  #   volumes:
  #     - pgdata:/var/lib/postgresql/data
  #   networks:
  #     - project-net
  #   # No ports published to host (INFRA-05)
  #   restart: unless-stopped

  # Optional sidecar: Redis (INFRA-01)
  # Uncomment when project needs a cache
  # redis:
  #   image: redis:7-alpine
  #   container_name: "devdock-{{PROJECT_SLUG}}-redis"
  #   networks:
  #     - project-net
  #   # No ports published to host (INFRA-05)
  #   restart: unless-stopped

networks:
  project-net:
    name: "devdock-{{PROJECT_SLUG}}-net"
    driver: bridge
    # internal: false -- containers need internet for npm install, git clone (Pitfall #6)
    # Security: no ports published means no inbound from host (INFRA-05)

# Optional volumes for sidecars
# volumes:
#   pgdata:
#     name: "devdock-{{PROJECT_SLUG}}-pgdata"
`;

const defaultOptions: ComposeOptions = {
  projectSlug: 'my-project',
  projectName: 'My Project',
  baseImage: 'devdock-base:latest',
  hostUid: 1000,
  hostGid: 1000,
  enablePostgres: false,
  enableRedis: false,
};

describe('generateComposeFile', () => {
  beforeEach(() => {
    vi.mocked(readFile).mockReset();
    vi.mocked(writeFile).mockReset();
    vi.mocked(mkdir).mockReset();

    vi.mocked(readFile).mockResolvedValue(TEMPLATE_CONTENT);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  it('replaces all {{PROJECT_SLUG}} occurrences with the actual slug', async () => {
    await generateComposeFile(defaultOptions, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).not.toContain('{{PROJECT_SLUG}}');
    expect(writtenContent).toContain('my-project');
    expect(writtenContent).toContain('devdock-my-project-dev');
  });

  it('replaces {{BASE_IMAGE}}, {{HOST_UID}}, {{HOST_GID}}', async () => {
    const options = { ...defaultOptions, baseImage: 'custom:v2', hostUid: 1001, hostGid: 1002 };
    await generateComposeFile(options, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).not.toContain('{{BASE_IMAGE}}');
    expect(writtenContent).not.toContain('{{HOST_UID}}');
    expect(writtenContent).not.toContain('{{HOST_GID}}');
    expect(writtenContent).toContain('custom:v2');
    expect(writtenContent).toContain('1001');
    expect(writtenContent).toContain('1002');
  });

  it('uncomments postgres service block when enablePostgres=true', async () => {
    const options = { ...defaultOptions, enablePostgres: true };
    await generateComposeFile(options, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Should have uncommented postgres service
    expect(writtenContent).toContain('  postgres:');
    expect(writtenContent).toContain('image: postgres:16');
    expect(writtenContent).toContain('POSTGRES_DB:');
  });

  it('uncomments redis service block when enableRedis=true', async () => {
    const options = { ...defaultOptions, enableRedis: true };
    await generateComposeFile(options, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('  redis:');
    expect(writtenContent).toContain('image: redis:7-alpine');
  });

  it('uncomments both services and volumes section when both sidecars enabled', async () => {
    const options = { ...defaultOptions, enablePostgres: true, enableRedis: true };
    await generateComposeFile(options, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('  postgres:');
    expect(writtenContent).toContain('  redis:');
    // Volumes section should be uncommented
    expect(writtenContent).toMatch(/^volumes:/m);
  });

  it('keeps postgres and redis sections commented when no sidecars', async () => {
    await generateComposeFile(defaultOptions, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    // These should remain commented
    expect(writtenContent).toContain('  # postgres:');
    expect(writtenContent).toContain('  # redis:');
    // Volumes section should stay commented
    expect(writtenContent).not.toMatch(/^volumes:/m);
  });

  it('generates valid parseable YAML', async () => {
    const options = { ...defaultOptions, enablePostgres: true, enableRedis: true };
    await generateComposeFile(options, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    const parsed = parseYaml(writtenContent);
    expect(parsed).toBeDefined();
    expect(parsed.services).toBeDefined();
    expect(parsed.services.dev).toBeDefined();
    expect(parsed.networks).toBeDefined();
  });

  it('network name follows pattern devdock-{slug}-net', async () => {
    await generateComposeFile(defaultOptions, '/tmp/data');

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('devdock-my-project-net');
  });

  it('creates workspace directory at dataDir/{slug}/workspace/', async () => {
    await generateComposeFile(defaultOptions, '/tmp/data');

    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/data/my-project/workspace'),
      { recursive: true }
    );
  });

  it('writes compose file to dataDir/{slug}/docker-compose.yml', async () => {
    const result = await generateComposeFile(defaultOptions, '/tmp/data');

    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/data/my-project/docker-compose.yml'),
      expect.any(String),
      'utf-8'
    );
    expect(result).toContain('/tmp/data/my-project/docker-compose.yml');
  });
});
