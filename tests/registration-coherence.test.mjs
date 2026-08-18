import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function exportedFunctionBody(contents, functionName) {
  const start = contents.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const next = contents.indexOf('\nexport async function ', start + 1)
  return contents.slice(start, next === -1 ? contents.length : next)
}

test('manager signup keeps responsible CPF separate from the arena fiscal document', async () => {
  const [component, actions] = await Promise.all([
    source('src/components/auth/CustomSignUp.tsx'),
    source('src/modules/auth/actions/authActions.ts'),
  ])

  assert.match(component, /CPF do responsável/)
  assert.match(component, /CPF\/CNPJ da Arena/)
  assert.match(component, /cpf: responsibleCpf/)
  assert.match(component, /arenaDocument,/)
  assert.match(actions, /!isValidCpf\(input\.cpf\)/)
  assert.match(actions, /cleanArenaDocument = onlyDigits\(input\.arenaDocument\)/)
  assert.match(actions, /cpf: cleanCpf/)
  assert.match(actions, /arenaDocument: cleanArenaDocument/)
})

test('public email continuation does not enumerate existing account names or surfaces', async () => {
  const actions = await source('src/modules/auth/actions/authActions.ts')
  const checkEmail = exportedFunctionBody(actions, 'checkArenaSignupEmailAction')

  assert.doesNotMatch(checkEmail, /findUserByEmail|hasWebBackofficeAccess/)
  assert.match(checkEmail, /status: "new-user"/)
})

test('signup redirect is server-derived and full payload validation is server-side', async () => {
  const actions = await source('src/modules/auth/actions/authActions.ts')
  const signup = exportedFunctionBody(actions, 'startSignUpAction')

  assert.doesNotMatch(actions, /emailRedirectTo: string/)
  assert.match(actions, /await headers\(\)/)
  assert.match(signup, /validateArenaSignupData\(input\)/)
  assert.match(actions, /isStrongPassword\(input\.password\)/)
})

test('owner signup resolves catalog identity before provisioning a trial', async () => {
  const [actions, resolver] = await Promise.all([
    source('src/modules/auth/actions/authActions.ts'),
    source('src/modules/users/services/resolve-self-service-arena-signup.ts'),
  ])
  const provision = exportedFunctionBody(actions, 'provisionAfterSignUpAction')

  assert.match(provision, /resolveSelfServiceArenaSignup\(/)
  assert.match(provision, /operationId: user\.id/)
  assert.doesNotMatch(provision, /from\(["']arenas["']\)\.(insert|update)/)
  assert.match(resolver, /rpc\('resolve_self_service_arena_signup'/)
  assert.match(resolver, /result\.status === 'provisioned'/)
  assert.match(resolver, /ensureExperimentalSubscription\(\{ arenaId: result\.arenaId, actorId: input\.requesterUserId \}\)/)
  assert.match(resolver, /trial\.reason === 'plan_not_found'/)
})

test('backoffice registrations provision missing auth identities and commit athlete links atomically', async () => {
  const [userActions, athleteActions, modal] = await Promise.all([
    source('src/modules/users/actions/userActions.ts'),
    source('src/modules/athletes/actions/athleteActions.ts'),
    source('src/modules/users/components/UserFormModal.tsx'),
  ])
  const createUser = exportedFunctionBody(userActions, 'createArenaUserAction')
  const updateUser = exportedFunctionBody(userActions, 'updateArenaUserAction')
  const createAthlete = exportedFunctionBody(athleteActions, 'linkAthlete')

  assert.match(createUser, /if \(!newUser\?\.auth_user_id\)/)
  assert.match(createUser, /findUserByAuthUserId\(supabase, createdAuthUserId\)/)
  assert.match(createUser, /usesExistingCredentials/)
  assert.match(createUser, /isStrongPassword\(password\)/)
  assert.match(updateUser, /senha deve ser alterada pelo próprio usuário/)
  assert.doesNotMatch(updateUser, /auth\.admin\.updateUserById/)
  assert.match(createAthlete, /rpc\('provision_arena_athlete_profile'/)
  assert.doesNotMatch(createAthlete, /repo\.create\(|repo\.addSport\(/)
  assert.match(modal, /minLength=\{8\}/)
  assert.match(modal, /STRONG_PASSWORD_HELP/)
})
