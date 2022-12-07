import { Component } from "react";
import { useState, useEffect } from "react";
import axios, { Axios } from "axios";
import LoadingUsers from "../loading/loading";
import { Link, Outlet } from "react-router-dom";





export default function Users() {
  const[users, setUsers] = useState([]);
  const[isloading, setIsLoading] = useState(true);

  
  useEffect(()=>{
    async function fetchdata(){
      const response = await axios.get('https://reqres.in/api/users');
      // const json = await data.json;
      setTimeout(() => {
        setUsers(response.data.data);
        setIsLoading(false);
      }, 3000);
    }  
    fetchdata();
    },[])
    
 const a = users.length;
// console.log(isloading)
  
  const handlecreate = async()=>{
  const newuser = {
    first_name : "sasan",
    last_name : "mohtashme",
    email : "sasanmohtashme@gmail.com",
    avatar :  "",
    id : a > 5 ? (a+1):(a+1),
  }
  const response = await axios.post('https://reqres.in/api/users', newuser);
  setUsers([...users, newuser]);
 }
 async function handleupdate(user){
  user.first_name = 'updated'; 
  const response = await axios.put(`https://reqres.in/api/users/${user.id}`, user);
  const userupdate = [...users];
  const index = userupdate.indexOf(user);
  userupdate[index] = {...user};
  setUsers(userupdate);

}  
async function handledelete(user){
    const response = await axios.delete(`https://reqres.in/api/users/${user.id}`);
    const newuser = users.filter(u=>u.id !== user.id);
    setUsers(newuser);
} 
  
  
    return (
    <>
    <button onClick={handlecreate} className="btn btn-lg btn-primary">Create</button> 
    <div className="row">
        {isloading ? (<LoadingUsers />):(users.map((user)=>{
            return(
              <div className="col-4 text-center p-5">
                <img src={user.avatar} style={{borderRadius : "50%", width: "100"}} />
                <Link to = {`/users/${user.id}`}><h4>{user.first_name} {user.last_name}</h4></Link>
                <h5>{user.email}</h5>
                <div className="row">
                    <div className="col-6">
                        <button onClick={() => handleupdate(user)} className="btn btn-info btn-sm">update</button>
                    </div>
                    <div  onClick={() => handledelete(user)} className="col-6">
                        <button className="btn btn-danger btn-sm">delete</button>
                    </div>
                </div>
              </div>  
            )
        }))}
    </div>
    <Outlet/>
    </>
  )
}



// class Users extends Component {
//   state = { users: [],
//   isLoading: true } 

//   async componentDidMount(){
//      const response = await axios.get('https://reqres.in/api/users');
//     setTimeout(() => {
//       this.setState({users: response.data.data, isLoading : false})
//     }, 3000);
    
    
//   }

//   render() { 
//      const handlecreate = async()=>{
//       const newuser = {
//             first_name : "sasan",
//             last_name : "mohtashme",
//             email : "sasanmohtashme",
//             avatar :  ""
//           }
//           const response = await axios.post("https://reqres.in/api/users", newuser);
//           this.setState({users : [...this.state.users, newuser]});
//           // console.log(response);
//   }
//    function handleupdate(user){
          
//   }  
//   function handledelete(user){
          
//   } 
//     return (
//       <>
//     <button onClick={handlecreate} className="btn btn-lg btn-primary">Create</button> 
//      <div className="row">
//         {this.state.isLoading ?(<LoadingUsers/>):( this.state.users.map((user)=>{
//             return(
//               <div className="col-4 text-center p-5">
//                 <img src={user.avatar} style={{borderRadius : "50%" , width: "100"}} />
//                 <h4>{user.first_name} {user.last_name}</h4>
//                 <h5>{user.email}</h5>
//                 <div className="row">
//                     <div className="col-6">
//                         <button onClick={()=>{handleupdate(user)}} className="btn btn-info btn-sm">update</button>
//                     </div>
//                     <div  onClick={()=>{handledelete(user)}} className="col-6">
//                         <button className="btn btn-danger btn-sm">delete</button>
//                     </div>
//                 </div>
//               </div>  
//             )
//         }))}
//     </div>
//     </>
//     );
//   }
// }
 
// export default Users ;
