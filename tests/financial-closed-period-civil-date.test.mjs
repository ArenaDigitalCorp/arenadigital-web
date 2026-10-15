import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { format } from 'date-fns'

const source = readFileSync(new URL('../src/modules/finance/components/ArenaFinancialAccountCard.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('ArenaFinancialAccountCard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'closedPeriod')
assert.ok(declaration)
const code = ts.transpileModule(`${declaration.getText(ast)}; globalThis.result = closedPeriod();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

test('the closed financial period always ends yesterday in the local calendar', () => {
  const previous = process.env.TZ
  try {
    for (const [timezone, instant, startDate, finishDate] of [
      ['America/Sao_Paulo', '2026-10-15T00:30:00Z', '2026-09-14', '2026-10-13'],
      ['Pacific/Kiritimati', '2026-10-14T10:30:00Z', '2026-09-15', '2026-10-14'],
      ['UTC', '2026-10-15T00:30:00Z', '2026-09-15', '2026-10-14'],
      ['America/New_York', '2026-03-09T04:30:00Z', '2026-02-07', '2026-03-08'],
    ]) {
      process.env.TZ = timezone
      class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])) } }
      const context = { Date: FixedDate, format }
      vm.runInNewContext(code, context)
      assert.equal(context.result.startDate, startDate, timezone)
      assert.equal(context.result.finishDate, finishDate, timezone)
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
