import { useEffect } from "react";


const Logout = () => {
    useEffect(()=>{
        localStorage.removeItem('task');
        window.location = '/';
    },[])
    return null;
}
 
export default Logout;