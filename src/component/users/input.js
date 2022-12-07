
const Input = ({label, onChange,name}) => {
    
    
    return (
    <div className="mb-3">
      <label htmlFor="email">{label}:</label>
      <input ref={onChange}  className="form-control" name={name} id={name} type="text" />
    </div>
  );
};

export default Input;
