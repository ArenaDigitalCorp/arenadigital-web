import { loadTypescriptModule, realReact } from './load-typescript-module.mjs'

/** Hook lifecycle with controlled timers and responses, including cleanup on key change. */
export function hookController(path, exportName, args, imports = {}) {
  const state = [], refs = [], effects = [], queued = [], timers = new Map()
  let si, ri, ei, dirty = true, result, timerId = 0
  const react = { ...realReact,
    useState(initial) { const i = si++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; dirty = true }] },
    useRef(initial) { return refs[ri++] ??= { current: initial } },
    useEffect(effect, deps) { const i = ei++, previous = effects[i]
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
        queued.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: effect() } })
      } },
  }
  const loaded = loadTypescriptModule(path, { ...imports, react }, {
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    fetch: (...args) => imports.fetch(...args),
  })
  return {
    render() { let turns = 0
      do { dirty = false; si = ri = ei = 0; result = loaded[exportName](...args); while (queued.length) queued.shift()(); if (++turns > 20) throw Error('Render loop') } while (dirty)
      return result
    },
    timers,
    async runTimers() { const jobs = [...timers.values()]; timers.clear(); await Promise.all(jobs.map(job => job.fn())) },
    unmount() { for (const effect of effects) effect?.cleanup?.() },
  }
}
