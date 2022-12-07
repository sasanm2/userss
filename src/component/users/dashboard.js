import { useParams,useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import queryString from 'query-string';
import { useRef } from "react";

const Dashboard = () => {
  const {id} = useParams();
  const navigate = useNavigate();
  const [user,setUser] = useState({});
  const firstName = useRef(null);


  useEffect(()=>{
    async function fetchdata(){
      const response = await axios.get(`https://reqres.in/api/users/${id}`);
        setUser(response.data.data);
    }  
    fetchdata();
    },[])

    console.log(firstName.current);
    return (
    <>
      <img src={user.avatar} style={{ borderRadius: "50%", width: "100" }} />
        <h4 ref={firstName}>
          {user.first_name} {user.last_name}
        </h4>
      <h5>{user.email}</h5>
      <button onClick={()=>{navigate('/users')}} className="btn btn-info btn-sm">redirect</button>
      
    </>
  );
};

export default Dashboard;
