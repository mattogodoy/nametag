import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import PhotoSourceModal from '../../components/PhotoSourceModal';
import enMessages from '../../locales/en.json';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function createFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

describe('PhotoSourceModal', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title and dropzone text', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    expect(screen.getByText('Add Photo')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop, paste, or click to browse')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    screen.getByRole('button', { name: /close/i }).click();
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking the backdrop', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const backdrop = screen.getByTestId('photo-source-backdrop');
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onSelect with a valid file from file input', async () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const file = createFile('photo.png', 'image/png', 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnSelect).toHaveBeenCalledWith(file);
  });

  it('rejects files with invalid type', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const file = createFile('doc.pdf', 'application/pdf', 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('rejects files exceeding 50MB', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const file = createFile('big.png', 'image/png', 51 * 1024 * 1024);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('handles paste event with image data', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const file = createFile('image.png', 'image/png', 1024);
    const pasteEvent = new Event('paste', { bubbles: true }) as ClipboardEvent;
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      },
    });

    document.dispatchEvent(pasteEvent);
    expect(mockOnSelect).toHaveBeenCalledWith(file);
  });

  it('handles drop event with image file', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const file = createFile('photo.jpg', 'image/jpeg', 2048);
    const dropzone = screen.getByTestId('photo-source-dropzone');
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(mockOnSelect).toHaveBeenCalledWith(file);
  });

  it('shows active state on dragover', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    const dropzone = screen.getByTestId('photo-source-dropzone');
    fireEvent.dragEnter(dropzone);

    expect(screen.getByText('Drop image here')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    render(
      <Wrapper>
        <PhotoSourceModal onSelect={mockOnSelect} onClose={mockOnClose} />
      </Wrapper>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledOnce();
  });
});
