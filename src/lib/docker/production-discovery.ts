import { readdir } from 'fs/promises';
import Docker from 'dockerode';
import { config } from '@/lib/config';

export interface ProductionApp {
  name: string;
  status: 'running' | 'stopped' | 'partial';
  containerCount: number;
  uptimeMs: number | null;
  exposedPorts: string[];
}

const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

export async function discoverProductionApps(): Promise<ProductionApp[]> {
  const appsDir = config.PRODUCTION_APPS_DIR;
  if (!appsDir) return [];

  let entries: string[];
  try {
    const dirents = await readdir(appsDir, { withFileTypes: true });
    entries = dirents.filter(d => d.isDirectory()).map(d => d.name);
  } catch {
    return [];
  }

  if (entries.length === 0) return [];

  const results = await Promise.allSettled(
    entries.map(async (projectName) => {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: [`com.docker.compose.project=${projectName}`] },
      });

      // Exclude devdock containers (Pitfall 3 from RESEARCH)
      const prodContainers = containers.filter(
        (c) => !c.Labels['com.docker.compose.project']?.startsWith('devdock-')
      );

      if (prodContainers.length === 0) return null;

      const running = prodContainers.filter((c) => c.State === 'running');
      const status: ProductionApp['status'] =
        running.length === prodContainers.length ? 'running' :
        running.length === 0 ? 'stopped' : 'partial';

      // Uptime from oldest running container's StartedAt
      let uptimeMs: number | null = null;
      if (running.length > 0) {
        try {
          const inspection = await docker.getContainer(running[0].Id).inspect();
          const startedAt = new Date(inspection.State.StartedAt).getTime();
          if (!isNaN(startedAt)) uptimeMs = Date.now() - startedAt;
        } catch {
          // Inspection failed -- leave uptimeMs null
        }
      }

      // Exposed ports (internal ports, not published -- per INFRA-05)
      const ports = new Set<string>();
      prodContainers.forEach((c) => {
        c.Ports.forEach((p) => {
          if (p.PrivatePort) ports.add(String(p.PrivatePort));
        });
      });

      return {
        name: projectName,
        status,
        containerCount: prodContainers.length,
        uptimeMs,
        exposedPorts: Array.from(ports),
      } satisfies ProductionApp;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ProductionApp | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is ProductionApp => v !== null);
}
