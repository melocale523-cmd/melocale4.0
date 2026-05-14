import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Silence sonner toasts in tests
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  Toaster: () => null,
}));
