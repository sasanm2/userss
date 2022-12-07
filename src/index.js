import  ReactDOM  from "react-dom/client";
import App from "./component/app";
import "bootstrap/dist/css/bootstrap.min.css";
import {BrowserRouter as Router} from 'react-router-dom';


const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
<Router>
 <App />
</Router> );

// ReactDOM.render(<App />, document.getElementById('app'));
