import { useRef, useState} from "react";
import{useNavigate} from 'react-router-dom';
import Input from "./input";
import * as yup from "yup";
import axios from "axios";

const Login = () => {
    const id = useNavigate();
    const [account, setAccount] = useState({
    account: { email: "", password: "" },
  });
  const [errors, setErrors] = useState([]);
  const[setpoint,setSetpoint]=useState(false);
  const email = useRef(null);
  const password = useRef(null);

  const Schema = yup.object().shape({
    email: yup
      .string()
      .email("ایمیل معتبر وارد کن")
      .required("وارد کردن ایمیل نیاز است"),
    password: yup
      .string()
      .min(4, "پسورد حداقل چهار کاراکر باشد")
      .max(15, "پسورد حداکثر پانزده کاراکر باشد"),
  });

  const validate = async () => {
    try {
      const resualt = await Schema.validate(account.account, {
        abortEarly: false,
      });
      return resualt;
    } catch (errors) {
      setErrors(errors.errors);
    }
  };

  const handesubmit = async (e) => {
    e.preventDefault();
    setAccount({
      account: { email: email.current.value, password: password.current.value },
    });
    const resualt = await validate();
    if (resualt) {
      try {
        setSetpoint(true);
        const response = await axios.post(
          "https://reqres.in/api/login",
          resualt
        );
        setSetpoint(false);
        const token = response.data.token;
        localStorage.setItem('task', token);
        // id('/users');
        window.location ='/';
      } catch (error) {
        setErrors(['ایمیل یا پسورد صحیح میباشد']);
        setSetpoint(false);
      }
    }
  };

  return (
    <>
      {errors.length !== 0 && (
        <div className="alert alert-danger">
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={handesubmit} className="mt-5 mr-5">
        <Input onChange={email} name="email" label="Email" />
        <Input onChange={password} name="password" label="Password" />
        <button disabled={setpoint} className="btn btn-primary">Login</button>
      </form>
    </>
  );
};

export default Login;
