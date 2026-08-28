import {NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { useContext } from "react";
import Context from "./context/context";
import "./navbar.css";

// the bar is dark now, so the resting links are light and the active one is a
// red that still reads against the dark background
const linkcolor = ({isActive}) => {
  return {color: isActive ? '#ff6b6b' : '#c9d1d9'};
};

const Navbar = () => {
  const context = useContext(Context);
  const user = context.user;

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark app-navbar">
  <div className="container-fluid">
    {!user ? (<NavLink style={linkcolor} className="navbar-brand" to="/login">Login</NavLink>):(<NavLink style={linkcolor} className="navbar-brand" to="/logout">Logout</NavLink>)}
    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
      <span className="navbar-toggler-icon"></span>
    </button>
    <div className="collapse navbar-collapse" id="navbarNav">
      <ul className="navbar-nav">
        <li className="nav-item">
          <NavLink style={linkcolor} className="nav-link" aria-current="page" to="/">Home</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={linkcolor} className="nav-link" to='/users'>users</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={linkcolor} className="nav-link" to='/crypto'>crypto</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={linkcolor} className="nav-link" to="/about">about</NavLink>
        </li>
      </ul>
    </div>
  </div>
</nav>
    </>
  );
};

export default Navbar;
