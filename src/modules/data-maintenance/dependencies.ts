import type { CleanupDependency, CleanupModule } from './types'

export function includableDependencies(edges: CleanupDependency[], selected: CleanupModule[]): CleanupModule[] {
  const candidates = [...new Set(edges.flatMap(edge => edge.to && edge.missingCount > 0 ? [edge.to] : []))]
  return candidates.filter(id => !selected.includes(id) && edges.filter(edge => edge.to === id && edge.missingCount + edge.blockedCount > 0)
    .every(edge => edge.canInclude && edge.blockedCount === 0))
}

export function dependencyGroups(edges: CleanupDependency[], selected: CleanupModule[]) {
  const available = includableDependencies(edges, selected)
  const groups = new Map<string, { to: CleanupModule | null; label: string; from: CleanupModule[]; count: number; missing: number; blocked: number }>()
  for (const edge of edges) {
    const key = edge.to ?? 'protected'
    const group = groups.get(key) ?? { to: edge.to, label: edge.label, from: [], count: 0, missing: 0, blocked: 0 }
    if (!group.from.includes(edge.from)) group.from.push(edge.from)
    group.count += edge.count
    group.missing += edge.missingCount
    group.blocked += edge.blockedCount
    groups.set(key, group)
  }
  return [...groups.values()].map(group => ({ ...group, status: group.blocked > 0 || (group.missing > 0 && (!group.to || !available.includes(group.to))) ? 'protected' as const : group.missing > 0 ? 'required' as const : 'included' as const }))
}

/** Ownership comes from explicit roots, never from an automatic back-edge.
 * A -> C -> A must still allow the operator to remove the single root A. */
export function selectionOwnership(roots: CleanupModule[], selected: CleanupModule[], edges: CleanupDependency[]) {
  const links = new Map<CleanupModule, Set<CleanupModule>>()
  for (const edge of edges) {
    if (!edge.to || edge.blockedCount>0 || edge.missingCount>0 || !selected.includes(edge.from) || !selected.includes(edge.to)) continue
    if (!links.has(edge.from)) links.set(edge.from,new Set())
    links.get(edge.from)!.add(edge.to)
  }
  const owners = new Map<CleanupModule, CleanupModule[]>()
  const descendants = new Map<CleanupModule, CleanupModule[]>()
  for (const root of roots) {
    const visited = new Set<CleanupModule>()
    const visit = (id: CleanupModule) => {if(visited.has(id))return;visited.add(id);for(const child of links.get(id)??[])visit(child)}
    visit(root)
    descendants.set(root,[...visited].filter(id=>id!==root))
    for (const id of visited) owners.set(id,[...(owners.get(id)??[]),root])
  }
  return {
    descendants,
    requiredBy: (id: CleanupModule) => (owners.get(id)??[]).filter(root=>root!==id),
    fullyExplained: selected.every(id=>owners.has(id)),
  }
}
