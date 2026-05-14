import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// vi.hoisted — accessible inside vi.mock factory (hoisted before imports)
const mockSubmitReview = vi.hoisted(() => vi.fn());

vi.mock('../services/reviewService', () => ({
  reviewService: { submitReview: mockSubmitReview },
}));

import ReviewModal from '../components/ReviewModal';

function renderModal(props: Partial<React.ComponentProps<typeof ReviewModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaults = {
    appointmentId: 'appt-1',
    professionalId: 'prof-1',
    clientId: 'client-1',
    professionalName: 'João Silva',
    onClose: vi.fn(),
    ...props,
  };
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <ReviewModal {...defaults} />
      </QueryClientProvider>
    ),
    onClose: defaults.onClose,
  };
}

describe('ReviewModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders professional name and the 5-star selector', () => {
    renderModal();
    expect(screen.getByText(/João Silva/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /estrela/ })).toHaveLength(5);
  });

  it('submit button is disabled when no star is selected', () => {
    renderModal();
    const btn = screen.getByRole('button', { name: /Enviar Avaliação/i });
    expect(btn).toBeDisabled();
  });

  it('enables submit after selecting a star', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: '3 estrelas' }));
    const btn = screen.getByRole('button', { name: /Enviar Avaliação/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls submitReview with correct data and closes on success', async () => {
    const fakeReview = { id: 'rev-1', rating: 4 };
    mockSubmitReview.mockResolvedValue(fakeReview);

    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: '4 estrelas' }));
    await user.type(screen.getByPlaceholderText(/Conte como foi/i), 'Ótimo serviço');
    await user.click(screen.getByRole('button', { name: /Enviar Avaliação/i }));

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          appointment_id: 'appt-1',
          professional_id: 'prof-1',
          client_id: 'client-1',
          rating: 4,
          comment: 'Ótimo serviço',
        })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when the Cancelar button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
