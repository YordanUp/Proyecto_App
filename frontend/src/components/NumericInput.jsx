const patterns = {
  // Keep numeric but invalid intermediate values editable so submit validation can explain them.
  integer: /^-?\d*(?:\.\d*)?$/,
  decimal: /^-?\d*(?:\.\d*)?$/
};

export default function NumericInput({ numericMode = 'decimal', onChange, ...props }) {
  const inputMode = numericMode === 'integer' ? 'numeric' : 'decimal';
  function handleChange(event) {
    if (!patterns[numericMode]?.test(event.target.value)) return;
    onChange?.(event);
  }

  return <input {...props} type="text" inputMode={inputMode} onChange={handleChange} />;
}
