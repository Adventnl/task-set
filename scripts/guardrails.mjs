import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve, relative, sep } from 'node:path'
import ts from 'typescript'

const root = resolve('src')
const errors = []

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

function report(path, message) {
  errors.push(`${relative(process.cwd(), path)}: ${message}`)
}

function layer(path) {
  const parts = relative(root, path).split(sep)
  if (parts.length === 1) return 'entry'
  if (parts[0] === 'shared') return parts[1] === 'hooks' ? 'hooks' : 'shared'
  return parts[0]
}

const allowed = {
  entry: new Set(['pages', 'shared']),
  pages: new Set(['pages', 'components', 'shared', 'hooks']),
  components: new Set(['components', 'shared', 'hooks']),
  services: new Set(['services', 'connectors', 'shared']),
  connectors: new Set(['shared']),
  hooks: new Set(['services', 'shared', 'hooks']),
  shared: new Set(['shared']),
}

const files = filesIn(root)
const sourceFiles = files.filter((file) => /\.[cm]?[jt]sx?$/.test(file))
const options = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  allowImportingTsExtensions: true,
}
const compilerHost = ts.createCompilerHost(options)

for (const file of files) {
  const parts = relative(root, file).split(sep)
  if (parts.includes('features')) report(file, 'features/ is not a source home')
  if (
    parts[0] === 'components' &&
    (parts.length !== 4 || parts[3] !== 'index.tsx')
  ) {
    report(file, 'components belong in components/<domain>/<Name>/index.tsx')
  }
  if (
    parts[0] === 'pages' &&
    (parts.length !== 3 || !/^(index|[A-Z]\w*Screen)\.tsx$/.test(parts[2]))
  ) {
    report(file, 'pages may contain only index.tsx and named Screen.tsx files')
  }
  if (
    parts[0] === 'shared' &&
    !['types', 'utils', 'hooks', 'styles', 'config'].includes(parts[1])
  ) {
    report(file, 'shared/ accepts only types, utils, hooks, styles, and config')
  }
  if (
    !['components', 'pages', 'services', 'connectors', 'shared'].includes(
      parts[0],
    ) &&
    !['main.tsx', 'styles.css'].includes(parts[0])
  ) {
    report(file, 'unexpected top-level source home')
  }
  if (file.endsWith(`${sep}index.ts`))
    report(file, 'barrel index.ts exports hide concrete modules')
}

for (const file of sourceFiles) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  function inspect(node) {
    let specifier
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifier = node.moduleSpecifier.text
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifier = node.arguments[0].text
    }
    if (specifier?.startsWith('.')) {
      const target = specifier.endsWith('.css')
        ? resolve(dirname(file), specifier)
        : ts.resolveModuleName(specifier, file, options, compilerHost)
            .resolvedModule?.resolvedFileName
      if (!target || !existsSync(target) || !statSync(target).isFile()) {
        report(file, `unresolved import ${specifier}`)
      } else if (
        !target.endsWith('.css') &&
        target.startsWith(`${root}${sep}`) &&
        !allowed[layer(file)]?.has(layer(target))
      ) {
        report(
          file,
          `${layer(file)} cannot import ${layer(target)}: ${specifier}`,
        )
      } else if (
        target &&
        layer(file) === 'pages' &&
        layer(target) === 'pages' &&
        relative(root, file).split(sep)[1] !==
          relative(root, target).split(sep)[1]
      ) {
        report(file, `pages cannot import another route: ${specifier}`)
      } else if (
        target &&
        layer(file) === 'components' &&
        layer(target) === 'hooks' &&
        ts.isImportDeclaration(node) &&
        !node.importClause?.isTypeOnly
      ) {
        report(file, `components may import hook types only: ${specifier}`)
      }
    }
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Guardrails passed: ${sourceFiles.length} source modules checked`)
}
