import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { ComposeOptions } from './types';

/**
 * Uncomments a sidecar section in the compose template.
 *
 * Sidecar sections are identified by a comment marker line like `  # postgres:`
 * and end before the next blank line or unindented line. Each line within the
 * section has its `# ` prefix removed (preserving indentation).
 */
function uncommentSection(template: string, sectionName: string): string {
  const lines = template.split('\n');
  const result: string[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of the sidecar section: `  # sectionName:`
    if (!inSection && line.match(new RegExp(`^  # ${sectionName}:`))) {
      inSection = true;
      // Uncomment this line: remove `# ` after leading whitespace
      result.push(line.replace(/^(\s*)# /, '$1'));
      continue;
    }

    if (inSection) {
      // End detection: a line that doesn't start with `  #` and is not blank,
      // OR a blank line followed by something else
      if (line.trim() === '') {
        // Blank line ends the section
        inSection = false;
        result.push(line);
        continue;
      }

      if (!line.match(/^\s+#/)) {
        // Non-comment, non-blank line - section ended
        inSection = false;
        result.push(line);
        continue;
      }

      // Uncomment: remove `# ` after leading whitespace
      result.push(line.replace(/^(\s*)#\s?/, '$1'));
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Uncomments the volumes section at the bottom of the compose template.
 * Only uncomments pgdata volume if postgres is enabled.
 */
function uncommentVolumes(template: string, enablePostgres: boolean): string {
  const lines = template.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match `# volumes:` at the root level (no leading whitespace)
    if (line === '# volumes:') {
      result.push('volumes:');
      continue;
    }

    // Match `#   pgdata:` - only uncomment if postgres is enabled
    if (line.match(/^#\s+pgdata:/) && enablePostgres) {
      result.push(line.replace(/^#\s+/, '  '));
      continue;
    }

    // Match `#     name:` for volume naming
    if (line.match(/^#\s+name:/) && enablePostgres) {
      result.push(line.replace(/^#\s+/, '    '));
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Generates a Docker Compose file from the base template.
 *
 * Reads the template, replaces variable placeholders, optionally uncomments
 * sidecar service sections, creates the workspace directory, and writes the
 * compose file to the project's data directory.
 *
 * @param options - Compose generation options
 * @param dataDir - Absolute path to the DevDock data directory
 * @returns Full path to the written compose file
 */
export async function generateComposeFile(
  options: ComposeOptions,
  dataDir: string,
): Promise<string> {
  // Read the base template
  const templatePath = path.join(process.cwd(), 'docker/templates/base-compose.yml');
  let template = await readFile(templatePath, 'utf-8');

  // Replace all template variables
  template = template.replace(/\{\{PROJECT_SLUG\}\}/g, options.projectSlug);
  template = template.replace(/\{\{PROJECT_NAME\}\}/g, options.projectName);
  template = template.replace(/\{\{BASE_IMAGE\}\}/g, options.baseImage);
  template = template.replace(/\{\{HOST_UID\}\}/g, String(options.hostUid));
  template = template.replace(/\{\{HOST_GID\}\}/g, String(options.hostGid));

  // Claude config mount (D-07, D-09): read-only to protect host config
  const claudeConfigPath = options.claudeConfigPath;
  if (claudeConfigPath) {
    template = template.replace(
      /\{\{CLAUDE_CONFIG_MOUNT\}\}/g,
      `- ${claudeConfigPath}:/home/dev/.claude:ro`,
    );
  } else {
    // Remove the mount placeholder line entirely
    template = template.replace(/.*\{\{CLAUDE_CONFIG_MOUNT\}\}\n/g, '');
  }

  // ANTHROPIC_API_KEY injection (D-08)
  template = template.replace(
    /\{\{ANTHROPIC_API_KEY\}\}/g,
    options.anthropicApiKey || '',
  );

  // Uncomment sidecar sections if enabled
  if (options.enablePostgres) {
    template = uncommentSection(template, 'postgres');
  }

  if (options.enableRedis) {
    template = uncommentSection(template, 'redis');
  }

  // Uncomment volumes section if any sidecar needs volumes
  if (options.enablePostgres || options.enableRedis) {
    template = uncommentVolumes(template, options.enablePostgres);
  }

  // Create workspace directory
  const projectDir = path.join(dataDir, options.projectSlug);
  const workspaceDir = path.join(projectDir, 'workspace');
  await mkdir(workspaceDir, { recursive: true });

  // Write compose file
  const composePath = path.join(projectDir, 'docker-compose.yml');
  await writeFile(composePath, template, 'utf-8');

  return composePath;
}
