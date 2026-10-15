import { fireEvent, render, screen } from '@testing-library/react';
import NumericInput from './NumericInput';

describe('NumericInput', () => {
  it.each([
    ['quantity', 'Cantidad', '2'],
    ['unitPrice', 'Precio unitario', '10.25'],
    ['unitCost', 'Costo unitario', '8.75'],
    ['taxRate', 'Impuesto %', '16.5']
  ])('wheel on %s blurs without changing its value', (name, label, value) => {
    render(<label>{label}<NumericInput aria-label={name} value={value} readOnly /></label>);
    const input = screen.getByRole('spinbutton', { name });
    const blur = vi.spyOn(input, 'blur');
    fireEvent.wheel(input);
    expect(blur).toHaveBeenCalledOnce();
    expect(input).toHaveValue(Number(value));
  });
});
