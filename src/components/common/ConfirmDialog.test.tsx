import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';
import { actions } from '@/lib/copy';

/**
 * Defect 10: "Cancel" in the original app's navigation-warning dialog called
 * pop() and threw the user out of the screen entirely.
 */
describe('ConfirmDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <span data-testid="host">host screen</span>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="כותרת"
          description="גוף ההודעה"
          onConfirm={onConfirm}
        />
      </>
    );
  }

  it('cancel closes the dialog and does nothing else', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: actions.cancel }));

    // Dialog gone...
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // ...the confirm handler never ran...
    expect(onConfirm).not.toHaveBeenCalled();
    // ...and the screen behind it is untouched.
    expect(screen.getByTestId('host')).toBeInTheDocument();
  });

  it('confirm calls the handler', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: actions.confirm }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('escape closes without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('names what is affected and disables both actions while pending', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="מחיקת תחנה"
        description="האם אתה בטוח שברצונך למחוק את תחנת רמלה?"
        pending
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByText('האם אתה בטוח שברצונך למחוק את תחנת רמלה?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: actions.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: actions.cancel })).toBeDisabled();
  });
});
