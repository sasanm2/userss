import  ReactDOM  from "react-dom/client";
import App from "./component/app";
import "bootstrap/dist/css/bootstrap.min.css";
import {BrowserRouter as Router} from 'react-router-dom';


const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
<Router basename={process.env.PUBLIC_URL}>
 <App />
</Router> );

// registers the worker that makes the app installable on android. it is only
// served from a build, so the dev server is unaffected
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`).catch(()=>{});
  });
}

// ReactDOM.render(<App />, document.getElementById('app'));
