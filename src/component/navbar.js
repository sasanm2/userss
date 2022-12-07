import {NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { useContext } from "react";
import Context from "./context/context";

const Navbar = () => {
  const context = useContext(Context);
  const user = context.user;

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-light">
  <div className="container-fluid">
    {!user ? (<NavLink style={({isActive})=>{return{color: isActive ? 'red' : 'black'}}} className="navbar-brand" to="/login">Login</NavLink>):(<NavLink style={({isActive})=>{return{color: isActive ? 'red' : 'black'}}} className="navbar-brand" to="/logout">Logout</NavLink>)}
    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
      <span className="navbar-toggler-icon"></span>
    </button>
    <div className="collapse navbar-collapse" id="navbarNav">
      <ul className="navbar-nav">
        <li className="nav-item">
          <NavLink style={({isActive})=>{return{color: isActive ? 'red' : 'black'}}} className="nav-link" aria-current="page" to="/">Home</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={({isActive})=>{return{color: isActive ? 'red' : 'black'}}} className="nav-link" to='/users'>users</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={({isActive})=>{return{color: isActive ? 'red' : 'black'}}} className="nav-link" to="/about">about</NavLink>
        </li>
      </ul>
    </div>
  </div>
</nav>
    </>
  );
};

export default Navbar;
