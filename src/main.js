import { startRouter } from "./router.js";
import { getSession } from "./auth.js";

const app = document.getElementById("app");

getSession().then((session) => {
  if (!session.ok) {
    location.replace("/gate.html");
    return;
  }
  startRouter(app);
});
