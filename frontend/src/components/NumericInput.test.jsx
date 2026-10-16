import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import NumericInput from './NumericInput';

function ControlledInput({ numericMode, initial = '' }) {
  const [value, setValue] = useState(initial);
  return <NumericInput aria-label="Cantidad" numericMode={numericMode} value={value} onChange={event => setValue(event.target.value)} />;
}

describe('NumericInput', () => {
  it('uses text with a numeric input mode for integer fields', () => {
    render(<ControlledInput numericMode="integer" initial="2" />);
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'numeric');
    expect(input).toHaveValue('2');
  });

  it.each(['0', '0.5', '15', '15.50'])('accepts decimal text %s', value => {
    render(<ControlledInput numericMode="decimal" />);
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'decimal');
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue(value);
    expect(input).not.toHaveAttribute('type', 'number');
  });

  it('allows clearing fields and ignores arbitrary text', () => {
    render(<ControlledInput numericMode="integer" initial="12" />);
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input).toHaveValue('');
  });

  it.each([['Precio', '500'], ['Costo', '12.50'], ['Impuesto', '16.5']])('wheel does not change %s and browser exposes no number spinner', (label, value) => {
    render(<ControlledInput numericMode="decimal" initial={value} />);
    const input = screen.getByRole('textbox', { name: 'Cantidad' });
    fireEvent.wheel(input, { deltaY: -100 });
    expect(input).toHaveValue(value);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
