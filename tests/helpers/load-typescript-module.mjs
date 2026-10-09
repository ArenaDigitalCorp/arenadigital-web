import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
const repo = new URL('../../', import.meta.url)

export function loadTypescriptModule(path, imports = {}, globals = {}) {
  const cache = new Map()

  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href).exports
    const source = readFileSync(url, 'utf8')
    const loadedModule = { exports: {} }
    cache.set(url.href, loadedModule)
    const code = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText
    const localRequire = createRequire(url)
    vm.runInNewContext(code, {
      module: loadedModule,
      exports: loadedModule.exports,
      console,
      Date,
      Error,
      TypeError,
      URL,
      URLSearchParams,
      FormData,
      Blob,
      File,
      Request,
      Response,
      Headers,
      AbortController,
      AbortSignal,
      ReadableStream,
      Buffer,
      TextEncoder,
      TextDecoder,
      fetch,
      process,
      setTimeout,
      clearTimeout,
      ...globals,
      require(name) {
        if (Object.hasOwn(imports, name)) return imports[name]
        if (name.startsWith('@/')) {
          const base = new URL(`src/${name.slice(2)}`, repo)
          for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
            const candidate = new URL(`${base.href}${suffix}`)
            try { return load(candidate) } catch (error) {
              if (error.code !== 'ENOENT') throw error
            }
          }
          throw new Error(`Unresolved test import: ${name}`)
        }
        if (name.startsWith('.')) {
          const base = new URL(name, url)
          for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
            try { return load(new URL(`${base.href}${suffix}`)) } catch (error) {
              if (error.code !== 'ENOENT') throw error
            }
          }
        }
        return localRequire(name)
      },
    }, { filename: fileURLToPath(url) })
    return loadedModule.exports
  }

  return Array.isArray(path) ? path.map(candidate => load(new URL(candidate, repo))) : load(new URL(path, repo))
}

export const realReact = nativeRequire('react')
