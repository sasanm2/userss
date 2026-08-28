import {NavLink, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { useContext } from "react";
import Context from "./context/context";
import "./navbar.css";

// the bar follows the page under it: light everywhere, dark over the crypto
// pages, where the active red is brightened so it still reads
const linkcolor = (isDark) => {
  return ({isActive}) => {
    if(isDark){
      return {color: isActive ? '#ff6b6b' : '#c9d1d9'};
    }
    return {color: isActive ? 'red' : 'black'};
  };
};

const Navbar = () => {
  const context = useContext(Context);
  const user = context.user;
  const location = useLocation();
  const isDark = location.pathname.startsWith('/crypto');
  const color = linkcolor(isDark);

  return (
    <>
      <nav className={`navbar navbar-expand-lg ${isDark ? 'navbar-dark app-navbar' : 'bg-light'}`}>
  <div className="container-fluid">
    {!user ? (<NavLink style={color} className="navbar-brand" to="/login">Login</NavLink>):(<NavLink style={color} className="navbar-brand" to="/logout">Logout</NavLink>)}
    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
      <span className="navbar-toggler-icon"></span>
    </button>
    <div className="collapse navbar-collapse" id="navbarNav">
      <ul className="navbar-nav">
        <li className="nav-item">
          <NavLink style={color} className="nav-link" aria-current="page" to="/">Home</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={color} className="nav-link" to='/users'>users</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={color} className="nav-link" to='/crypto'>crypto</NavLink>
        </li>
        <li className="nav-item">
          <NavLink style={color} className="nav-link" to="/about">about</NavLink>
        </li>
      </ul>
    </div>
  </div>
</nav>
    </>
  );
};

export default Navbar;
