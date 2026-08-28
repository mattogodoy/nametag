import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guards against private registry URLs reaching the committed lockfile.
 *
 * npm resolves its registry from, in order: CLI flag, environment, project
 * .npmrc, user .npmrc. An `NPM_CONFIG_REGISTRY` environment variable therefore
 * beats the registry pin in this repo's .npmrc, and an install run on a machine
 * that sets one rewrites every touched `resolved` URL to point at that private
 * mirror. CI then fails at `npm ci` with ENOTFOUND, because a GitHub runner
 * cannot reach a corporate host, and the failure looks like a broken build
 * rather than a bad lockfile. This has happened twice.
 */
describe('package-lock.json registry hygiene', () => {
  const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

  it('resolves every package from the public npm registry', () => {
    const lockfile: unknown = JSON.parse(
      readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8')
    );

    if (typeof lockfile !== 'object' || lockfile === null || !('packages' in lockfile)) {
      throw new Error('package-lock.json has no "packages" object');
    }

    const packages = (lockfile as { packages: Record<string, { resolved?: unknown }> }).packages;

    const foreign = Object.entries(packages)
      .filter(([, entry]) => typeof entry?.resolved === 'string')
      .map(([name, entry]) => ({ name, resolved: entry.resolved as string }))
      .filter(({ resolved }) => !resolved.startsWith(PUBLIC_REGISTRY))
      .map(({ name, resolved }) => `${name} -> ${resolved}`);

    expect(
      foreign,
      'Lockfile entries point at a non-public registry. This usually means npm ' +
        'install ran with NPM_CONFIG_REGISTRY set, which overrides the project ' +
        '.npmrc. Re-run with `NPM_CONFIG_REGISTRY= npm install`, or unset it for ' +
        'this repo, then commit the corrected lockfile.'
    ).toEqual([]);
  });
});
