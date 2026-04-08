import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function normalizeVersion(input) {
  return input.replace(/^refs\/tags\//, '').trim();
}

function buildCandidates(version) {
  const plain = version.replace(/^v/, '');
  return Array.from(new Set([version, plain, `v${plain}`]));
}

function extractSections(changelog) {
  const lines = changelog.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^## \[(.+?)\]\s*$/);

    if (match) {
      if (current) sections.push(current);
      current = { title: match[1], lines: [] };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function findSection(sections, candidates) {
  return sections.find((section) => candidates.includes(section.title));
}

function trimSectionBody(lines) {
  const body = lines.join('\n').trim();
  return body.length > 0 ? body : '- No release notes were captured for this version.';
}

const versionArg = process.argv[2];
const outputArg = process.argv[3] ?? 'release-notes.md';

if (!versionArg) {
  console.error('Usage: node .github/scripts/extract-release-notes.mjs <version> [output-file]');
  process.exit(1);
}

const version = normalizeVersion(versionArg);
const workspaceRoot = process.cwd();
const changelogPath = resolve(workspaceRoot, 'CHANGELOG.md');
const outputPath = resolve(workspaceRoot, outputArg);
const changelog = readFileSync(changelogPath, 'utf8');
const sections = extractSections(changelog);
const requestedSection = findSection(sections, buildCandidates(version));
const fallbackSection = sections.find((section) => section.title === 'Unreleased');
const selectedSection = requestedSection ?? fallbackSection;

if (!selectedSection) {
  console.error('No matching version section and no [Unreleased] section found in CHANGELOG.md');
  process.exit(1);
}

const notes = [
  `# YClaw ${version}`,
  '',
  requestedSection
    ? `Release notes sourced from \`CHANGELOG.md\` section \`[${selectedSection.title}]\`.`
    : `Release notes sourced from \`CHANGELOG.md\` section \`[Unreleased]\` because no explicit section for \`${version}\` was found.`,
  '',
  trimSectionBody(selectedSection.lines),
  '',
].join('\n');

writeFileSync(outputPath, notes);
console.log(`Release notes written to ${outputArg}`);
