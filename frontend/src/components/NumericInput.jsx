export default function NumericInput({ onWheel, ...props }) {
  function preventWheelChange(event) {
    event.currentTarget.blur();
    onWheel?.(event);
  }

  return <input {...props} type="number" onWheel={preventWheelChange} />;
}
