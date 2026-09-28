import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatBookingParticipantLabel,
  getBookingParticipantNames,
} from '../src/modules/bookings/utils/booking-participants.ts'

const participant = (atleta_id, nome_perfil, funcao = 'convidado') => ({
  atleta_id,
  funcao,
  atleta: { nome_perfil },
})

test('responsável aparece primeiro mesmo quando o banco devolve convidados antes', () => {
  const booking = {
    athlete_id: 'iria',
    athlete_name: 'Iria STERTZ',
    booking_participants: [
      participant('osni', 'Osni Jacó da Silva'),
      participant('eriete', 'Eriéte Maria Consoni'),
      participant('iria', 'Iria STERTZ', 'responsavel'),
      participant('magali', 'Magali Crippa Lemos'),
    ],
  }

  assert.deepEqual(getBookingParticipantNames(booking), [
    'Iria STERTZ',
    'Osni Jacó da Silva',
    'Eriéte Maria Consoni',
    'Magali Crippa Lemos',
  ])
  assert.equal(formatBookingParticipantLabel(booking), 'Iria STERTZ, Osni Jacó da Silva +2')
})

test('sem linha "responsavel", o dono da reserva (athlete_id) vai primeiro', () => {
  const booking = {
    athlete_id: 'ana',
    athlete_name: 'Ana',
    booking_participants: [participant('bia', 'Bia'), participant('ana', 'Ana')],
  }

  assert.deepEqual(getBookingParticipantNames(booking), ['Ana', 'Bia'])
})

test('responsável fora dos participantes é incluído na frente', () => {
  const booking = {
    athlete_id: 'ana',
    athlete_name: 'Ana',
    booking_participants: [participant('bia', 'Bia')],
  }

  assert.deepEqual(getBookingParticipantNames(booking), ['Ana', 'Bia'])
})

test('reserva sem participantes usa o nome do responsável', () => {
  assert.deepEqual(getBookingParticipantNames({ athlete_name: 'Ana', booking_participants: [] }), ['Ana'])
  assert.deepEqual(getBookingParticipantNames({ atleta: { nome_perfil: 'Bia' } }), ['Bia'])
  assert.equal(formatBookingParticipantLabel({ booking_participants: [] }), '—')
})
