import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import NotifPopupComponent from '../NotifPopup'

afterEach(cleanup)

describe('<NotifPopupComponent>', () => {
  it('renders null when popup is null', () => {
    const { container } = render(<NotifPopupComponent popup={null} onDismiss={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('renders title + message when notif provided', () => {
    render(<NotifPopupComponent
      popup={{ type: 'admin_notify', title: 'Annuncio', message: 'Test', icon: '📢' }}
      onDismiss={() => {}}
    />)
    expect(screen.getByText('Annuncio')).toBeTruthy()
    expect(screen.getByText('Test')).toBeTruthy()
  })

  it('renders icon when provided', () => {
    render(<NotifPopupComponent
      popup={{ type: 'item_redeemed', title: 'OK', message: '+100 oro', icon: '✅' }}
      onDismiss={() => {}}
    />)
    expect(screen.getByText('✅')).toBeTruthy()
  })
})
