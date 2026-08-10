import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = process.argv[2] ?? 'src';
const files = await sourceFiles(root);
if (files.length === 0) fail(`no TypeScript files found under ${root}`);

const violations = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind(file));
  collectFunctions(source, file, content, violations);
}
if (violations.length > 0) {
  fail(violations.join('\n'));
} else {
  console.log(`function length: checked ${files.length} files; all functions are 30 lines or fewer`);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : isSource(entry.name) ? [join(directory, entry.name)] : []));
  return files.flat();
}

function collectFunctions(source, file, content, violations) {
  const visit = (node) => {
    if (isFunction(node)) addViolation(node, source, file, content, violations);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function isFunction(node) {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function addViolation(node, source, file, content, violations) {
  const body = node.body;
  if (!body) return;
  const span = bodyLineCount(body, source, content);
  if (span > 30) violations.push(`${relative(process.cwd(), file)}:${functionName(node)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}:${span}`);
}

function bodyLineCount(body, source, content) {
  const first = source.getLineAndCharacterOfPosition(body.getStart(source)).line;
  const last = source.getLineAndCharacterOfPosition(body.end).line;
  const lines = content.split(/\r?\n/);
  const start = ts.isBlock(body) ? first + 1 : first;
  const end = ts.isBlock(body) ? last - 1 : last;
  return lines.slice(start, end + 1).filter((line) => line.trim().length > 0).length;
}

function functionName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const variable = ts.isVariableDeclaration(node.parent);
  return variable && ts.isIdentifier(variable.name) ? variable.name.text : '<anonymous>';
}

function scriptKind(file) {
  return file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function isSource(name) {
  return name.endsWith('.ts') || name.endsWith('.tsx');
}

function fail(message) {
  console.error(`function length: ${message}`);
  process.exitCode = 1;
}
