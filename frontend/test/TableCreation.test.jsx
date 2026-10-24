/**
 * @jest-environment jsdom
 */
 import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableCreation } from '../src/views/TableCreation.tsx'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function setup(props = {}) {
  const onClose = jest.fn()
  const onCreate = jest.fn()
  const onUpdate = jest.fn()
  const user = userEvent.setup()

  render(
    <TableCreation onClose={onClose} onCreate={onCreate} onUpdate={onUpdate} {...props} />
  )

  return { user, onClose, onCreate, onUpdate }
}

const submitButton = () => screen.getByRole('button', { name: /create & take a seat/i })
const nameInput = () => screen.getByLabelText(/table name/i)
const seatsSelect = () => screen.getByLabelText('Seats')
const cpuSwitch = () => screen.getByRole('switch', { name: /add cpu players/i })
const privateSwitch = () => screen.getByRole('switch', { name: /make table private/i })
const moreBots = () => screen.getByRole('button', { name: /more cpu players/i })
const fewerBots = () => screen.getByRole('button', { name: /fewer cpu players/i })

const existingTable = {
  id: 'abc123',
  name: 'Velvet Room',
  stakes: 'medium',
  blind: '5 / 10',
  players: 3,
  max: 4,
  status: 'active',
  avgPot: '$87',
  hands: 10,
  bots: 2,
  isPrivate: true,
}

// ---------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------

describe('TableCreation (create mode)', () => {
  test('renders the create form with default values', () => {
    setup()

    expect(screen.getByRole('heading', { name: 'Create your table' })).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Midnight Draw')
    expect(screen.getByText('13/28')).toBeInTheDocument()
    expect(seatsSelect()).toHaveValue('6')
    expect(screen.getByRole('button', { name: /^low/i })).toHaveAttribute('aria-pressed', 'true')
    expect(cpuSwitch()).not.toBeChecked()
    expect(privateSwitch()).not.toBeChecked()
    expect(screen.queryByText(/how many/i)).not.toBeInTheDocument()
    expect(submitButton()).toBeInTheDocument()
  })

  test('submits the default configuration', async () => {
    const { user, onCreate } = setup()

    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Midnight Draw',
      stakes: 'low',
      seats: 6,
      isPrivate: false,
      Bots: false,
      botCount: 0,
    })
  })

  test('does not call onUpdate in create mode', async () => {
    const { user, onUpdate } = setup()

    await user.click(submitButton())

    expect(onUpdate).not.toHaveBeenCalled()
  })

  test('submits a custom name, stakes, seats and private flag', async () => {
    const { user, onCreate } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Friday Night')
    await user.click(screen.getByRole('button', { name: /^high/i }))
    await user.selectOptions(seatsSelect(), '4')
    await user.click(privateSwitch())
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Friday Night',
      stakes: 'high',
      seats: 4,
      isPrivate: true,
      Bots: false,
      botCount: 0,
    })
  })

  test('trims the table name before submitting', async () => {
    const { user, onCreate } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), '   Padded Name   ')
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Padded Name' }))
  })

  test('falls back to "Untitled Table" when the name is blank', async () => {
    const { user, onCreate } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), '   ')

    expect(screen.getByRole('heading', { name: 'Untitled Table' })).toBeInTheDocument()

    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled Table' }))
  })

  test('character counter and preview follow the name as you type', async () => {
    const { user } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Friday Night')

    expect(screen.getByText('12/28')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Friday Night' })).toBeInTheDocument()
  })

  test.each([
    ['Low', 'low'],
    ['Mid', 'medium'],
    ['High', 'high'],
  ])('choosing %s stakes submits "%s"', async (label, value) => {
    const { user, onCreate } = setup()

    await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`, 'i') }))
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ stakes: value }))
  })

  test('choosing Mid stakes updates the pressed state and the preview', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: /^mid/i }))

    expect(screen.getByRole('button', { name: /^mid/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^low/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText(/Blinds 5 \/ 10/)).toBeInTheDocument()
    expect(screen.getAllByText('$500').length).toBeGreaterThan(0)
  })

  test('private toggle changes the access line in the preview', async () => {
    const { user } = setup()

    expect(screen.getByText('Public lobby')).toBeInTheDocument()

    await user.click(privateSwitch())

    expect(screen.getByText('Invite only')).toBeInTheDocument()
    expect(screen.queryByText('Public lobby')).not.toBeInTheDocument()
  })

  // ---- CPU players ----

  test('CPU counter appears when toggled on and hides again when toggled off', async () => {
    const { user } = setup()

    await user.click(cpuSwitch())
    expect(screen.getByText(/how many/i)).toBeInTheDocument()
    expect(screen.getByText('Max 5')).toBeInTheDocument()

    await user.click(cpuSwitch())
    expect(screen.queryByText(/how many/i)).not.toBeInTheDocument()
  })

  test('CPU count starts at 1, can be raised, and is submitted', async () => {
    const { user, onCreate } = setup()

    await user.click(cpuSwitch())
    expect(fewerBots()).toBeDisabled() // already at the minimum of 1

    await user.click(moreBots())
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ Bots: true, botCount: 2 })
    )
  })

  test('fewer button lowers the count and stops at 1', async () => {
    const { user, onCreate } = setup()

    await user.click(cpuSwitch())
    await user.click(moreBots())
    await user.click(moreBots())
    await user.click(fewerBots())
    await user.click(fewerBots())
    await user.click(fewerBots()) // disabled at 1, should do nothing
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ Bots: true, botCount: 1 })
    )
  })

  test('preview shows the CPU count with correct singular and plural wording', async () => {
    const { user } = setup()

    expect(screen.getByText('None')).toBeInTheDocument()

    await user.click(cpuSwitch())
    expect(screen.getByText('1 bot')).toBeInTheDocument()

    await user.click(moreBots())
    expect(screen.getByText('2 bots')).toBeInTheDocument()
  })

  test('bots are capped at seats minus one (host keeps a seat)', async () => {
    const { user } = setup()

    await user.selectOptions(seatsSelect(), '2')
    await user.click(cpuSwitch())

    expect(screen.getByText('Max 1')).toBeInTheDocument()
    expect(moreBots()).toBeDisabled()
    expect(fewerBots()).toBeDisabled()
  })

  test('reaching the maximum disables the + button', async () => {
    const { user } = setup()

    await user.selectOptions(seatsSelect(), '3')
    await user.click(cpuSwitch())
    await user.click(moreBots()) // 1 -> 2, which is the max for 3 seats

    expect(moreBots()).toBeDisabled()
  })

  test('shrinking the seat count clamps the CPU count', async () => {
    const { user, onCreate } = setup()

    await user.click(cpuSwitch())
    for (let i = 0; i < 4; i++) await user.click(moreBots()) // 1 -> 5
    expect(moreBots()).toBeDisabled()

    await user.selectOptions(seatsSelect(), '3') // max bots is now 2

    expect(screen.getByText('Max 2')).toBeInTheDocument()
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ seats: 3, Bots: true, botCount: 2 })
    )
  })

  test('turning CPU players off submits zero bots even after choosing a count', async () => {
    const { user, onCreate } = setup()

    await user.click(cpuSwitch())
    await user.click(moreBots())
    await user.click(cpuSwitch()) // off again
    await user.click(submitButton())

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ Bots: false, botCount: 0 })
    )
  })

  // ---- closing ----

  test('close button calls onClose', async () => {
    const { user, onClose } = setup()

    await user.click(screen.getByRole('button', { name: /close table setup/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking the dark backdrop calls onClose', async () => {
    const { user, onClose } = setup()

    await user.click(screen.getByRole('dialog').parentElement)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking inside the dialog does not close it', async () => {
    const { user, onClose } = setup()

    await user.click(screen.getByRole('heading', { name: 'Create your table' }))

    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------

describe('TableCreation (edit mode)', () => {
  test('shows the update wording and pre-fills the form from the table', () => {
    setup({ table: existingTable })

    expect(screen.getByRole('heading', { name: 'Update your table' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update Table' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create & take a seat/i })).not.toBeInTheDocument()

    expect(nameInput()).toHaveValue('Velvet Room')
    expect(seatsSelect()).toHaveValue('4')
    expect(screen.getByRole('button', { name: /^mid/i })).toHaveAttribute('aria-pressed', 'true')
    expect(privateSwitch()).toBeChecked()
    expect(cpuSwitch()).toBeChecked()
    expect(screen.getByText('Max 3')).toBeInTheDocument()
  })

  test('submitting calls onUpdate with the table settings and not onCreate', async () => {
    const { user, onCreate, onUpdate } = setup({ table: existingTable })

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({
      name: 'Velvet Room',
      stakes: 'medium',
      seats: 4,
      isPrivate: true,
      Bots: true,
      botCount: 2,
    })
    expect(onCreate).not.toHaveBeenCalled()
  })

  test('edited values are included in the update', async () => {
    const { user, onUpdate } = setup({ table: existingTable })

    await user.clear(nameInput())
    await user.type(nameInput(), 'Renamed Room')
    await user.click(screen.getByRole('button', { name: /^high/i }))
    await user.click(fewerBots())
    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    expect(onUpdate).toHaveBeenCalledWith({
      name: 'Renamed Room',
      stakes: 'high',
      seats: 4,
      isPrivate: true,
      Bots: true,
      botCount: 1,
    })
  })

  test('a table with no bots opens with CPU players switched off', async () => {
    const { user, onUpdate } = setup({ table: { ...existingTable, bots: 0 } })

    expect(cpuSwitch()).not.toBeChecked()
    expect(screen.queryByText(/how many/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ Bots: false, botCount: 0 })
    )
  })

  test('a table with undefined optional fields uses safe defaults', async () => {
    const minimal = {
      id: 1,
      name: 'Bare Table',
      stakes: 'low',
      blind: '1 / 2',
      players: 1,
      max: 6,
      status: 'waiting',
      avgPot: '—',
      hands: 0,
    }
    const { user, onUpdate } = setup({ table: minimal })

    expect(privateSwitch()).not.toBeChecked()
    expect(cpuSwitch()).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    expect(onUpdate).toHaveBeenCalledWith({
      name: 'Bare Table',
      stakes: 'low',
      seats: 6,
      isPrivate: false,
      Bots: false,
      botCount: 0,
    })
  })

  test('an unrecognised stakes value falls back to low', () => {
    setup({ table: { ...existingTable, stakes: 'banana' } })

    expect(screen.getByRole('button', { name: /^low/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('high stakes tables open with High selected', () => {
    setup({ table: { ...existingTable, stakes: 'high' } })

    expect(screen.getByRole('button', { name: /^high/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking Update without an onUpdate handler does not crash or create a table', async () => {
    const onClose = jest.fn()
    const onCreate = jest.fn()
    const user = userEvent.setup()
    render(<TableCreation onClose={onClose} onCreate={onCreate} table={existingTable} />)

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    expect(onCreate).not.toHaveBeenCalled()
  })
})