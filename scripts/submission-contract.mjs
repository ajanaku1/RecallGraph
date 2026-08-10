import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const screenshotNames = [
  'landing.png',
  'closure-ready.png',
  'guarded-close.png',
  'verified-receipt.png',
];
const manifestFields = [
  'repositoryUrl',
  'liveUrl',
  'demoVideoUrl',
  'feedbackSurveyUrl',
];

/**
 * @typedef {{
 *   fetch: typeof fetch;
 *   probeVideoDuration: (path: string) => Promise<number>;
 * }} SubmissionServices
 */

/**
 * @param {string} root
 * @param {SubmissionServices} [services]
 * @returns {Promise<string[]>}
 */
export async function verifySubmission(root, services = defaultServices()) {
  const issues = [];
  const manifest = await readManifest(root, issues);
  await checkRequiredFiles(root, issues);
  await checkDocumentation(root, manifest, issues);
  await checkVideo(root, services.probeVideoDuration, issues);
  if (manifest) await checkPublicEvidence(manifest, services.fetch, issues);
  return issues;
}

function defaultServices() {
  return { fetch: globalThis.fetch, probeVideoDuration };
}

async function readManifest(root, issues) {
  const path = join(root, 'submission/manifest.json');
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (!isRecord(value) || value.schemaVersion !== 1) {
      issues.push('submission/manifest.json must use schemaVersion 1.');
      return undefined;
    }
    for (const field of manifestFields) {
      if (!isHttpsUrl(value[field])) issues.push(`submission manifest ${field} must be an HTTPS URL.`);
    }
    return value;
  } catch {
    issues.push('submission/manifest.json is missing or invalid.');
    return undefined;
  }
}

async function checkRequiredFiles(root, issues) {
  const required = [
    'README.md',
    'LICENSE',
    'submission/DEVPOST.md',
    'submission/LIMITATIONS.md',
    ...screenshotNames.map((name) => `docs/images/${name}`),
  ];
  const results = await Promise.all(required.map((path) => nonempty(join(root, path))));
  required.forEach((path, index) => {
    if (!results[index]) issues.push(`${path} is missing or empty.`);
  });
}

async function checkDocumentation(root, manifest, issues) {
  const readme = await textOrEmpty(join(root, 'README.md'));
  const license = await textOrEmpty(join(root, 'LICENSE'));
  const headings = ['## Live Demo', '## Demo Video', '## Running Locally', '## Limitations', '## License'];
  for (const heading of headings) {
    if (!readme.includes(heading)) issues.push(`README.md must include ${heading}.`);
  }
  if (!license.includes('Apache License') || !license.includes('Version 2.0')) {
    issues.push('LICENSE must contain Apache-2.0 text.');
  }
  if (manifest) {
    for (const field of manifestFields) {
      if (typeof manifest[field] === 'string' && !readme.includes(manifest[field])) {
        issues.push(`README.md must link ${field}.`);
      }
    }
  }
}

async function checkVideo(root, probeDuration, issues) {
  const path = join(root, 'video/out/demo.mp4');
  if (!await nonempty(path)) {
    issues.push('video/out/demo.mp4 is missing or empty.');
    return;
  }
  try {
    const duration = await probeDuration(path);
    if (!Number.isFinite(duration) || duration <= 0 || duration >= 180) {
      issues.push('video/out/demo.mp4 must be under 180 seconds.');
    }
  } catch {
    issues.push('video/out/demo.mp4 duration could not be verified with ffprobe.');
  }
}

async function checkPublicEvidence(manifest, fetcher, issues) {
  const coordinates = repositoryCoordinates(manifest.repositoryUrl);
  if (!coordinates) {
    issues.push('repositoryUrl must identify a GitHub owner and repository.');
  } else {
    await checkRepository(coordinates, manifest.liveUrl, fetcher, issues);
  }
  await Promise.all([
    checkReachable('liveUrl', manifest.liveUrl, fetcher, issues),
    checkReachable('demoVideoUrl', manifest.demoVideoUrl, fetcher, issues),
    checkReachable('feedbackSurveyUrl', manifest.feedbackSurveyUrl, fetcher, issues),
  ]);
}

async function checkRepository(coordinates, liveUrl, fetcher, issues) {
  try {
    const response = await fetcher(`https://api.github.com/repos/${coordinates}`, {
      headers: { 'User-Agent': 'RecallGraph-submission-verifier' },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const repository = await response.json();
    if (!isRecord(repository) || repository.private !== false) issues.push('GitHub repository must be public.');
    if (!isRecord(repository) || !nonblank(repository.description)) issues.push('GitHub About description is required.');
    if (!isRecord(repository) || repository.homepage !== liveUrl) issues.push('GitHub About homepage must match liveUrl.');
    const license = isRecord(repository) && isRecord(repository.license) ? repository.license.spdx_id : undefined;
    if (license !== 'Apache-2.0') issues.push('GitHub repository license must be Apache-2.0.');
  } catch {
    issues.push('GitHub repository metadata is not reachable.');
  }
}

async function checkReachable(label, url, fetcher, issues) {
  if (!isHttpsUrl(url)) return;
  try {
    const response = await fetcher(url, { redirect: 'follow' });
    if (!response.ok) issues.push(`${label} returned HTTP ${response.status}.`);
  } catch {
    issues.push(`${label} is not reachable.`);
  }
}

async function probeVideoDuration(path) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', path,
  ]);
  return Number.parseFloat(stdout.trim());
}

function repositoryCoordinates(value) {
  if (!isHttpsUrl(value)) return undefined;
  const url = new globalThis.URL(value);
  const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
  return url.hostname === 'github.com' && parts.length === 2 ? parts.join('/') : undefined;
}

async function nonempty(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function textOrEmpty(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new globalThis.URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonblank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
