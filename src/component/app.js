import {useEffect, useState } from "react";
import { Route, Routes,Navigate } from "react-router-dom";
import Users from "./users/users";
import  Context  from "./context/context";
import Navbar from './navbar';
import Home from './users/home';
import About from './users/about';
import Dashboard from './users/dashboard';
import Login from './users/login';
import Notfound from './users/notfound';
import Logout from "./users/logout";
import CryptoList from "./crypto/cryptolist";
import CryptoDetail from "./crypto/cryptodetail";
import CryptoScan from "./crypto/scan";


// inside the android shell the app always loads at "/", so the coin list is
// made the landing route there the way the pwa manifest does on the web
const isNative = Boolean(
  typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform
    ? window.Capacitor.isNativePlatform()
    : false
);

export default function App() {
  const[user,setUser] = useState(null);

  useEffect(()=>{
    const token = localStorage.getItem('task');
    if(!token){
      setUser(null);
      return;
    }
    const response = {
      data:{
        user:{
          name: 'sasan',
          email : 'sasanmohtashme@gmail.com'
        }
      }
    }
    if(!response.data.user){
      setUser(null);
    }else{
      setUser(response.data.user);
    }
  },[])
  return (
    <Context.Provider value={{user:user}}>
      <Navbar />
      <Routes>
       <Route path="/users" element={<Users />}/>
       <Route path="/login" element={<Login />}/>
       <Route path="/logout" element={<Logout/>}/>
       <Route path="/not-found" element={<Notfound />}/>
       <Route path="/users/:id" element={<Dashboard />}/>
       <Route path="/crypto" element={<CryptoList />}/>
       <Route path="/crypto/scan" element={<CryptoScan />}/>
       <Route path="/crypto/:id" element={<CryptoDetail />}/>
       <Route path="/" element={isNative ? <Navigate replace to="/crypto"/> : <Home />}/>
       <Route path="/about" element={<About />}/>
       <Route path="*" element={<Navigate replace to="/not-found"/> } />
       

       
    </Routes>
    </Context.Provider>
  )
}
