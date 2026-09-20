import { homePage } from "./pages/home.js";
import { boostingPage } from "./games/boosting/game.js";
import { overfittingPage } from "./games/overfitting/game.js";
import { samplingPage } from "./games/sampling/game.js";
import { lock } from "./auth.js";

const routes = {
  "": homePage,
  boosting: boostingPage,
  overfitting: overfittingPage,
  sampling: samplingPage,
};

export function startRouter(root) {
  let teardown = null;

  const render = () => {
    if (typeof teardown === "function") teardown();
    teardown = null;
    const hash = location.hash.replace(/^#\/?/, "").split("?")[0];
    const page = routes[hash] || homePage;
    page(root);
    if (page.teardown) teardown = page.teardown;
  };

  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-action=signout]")) lock();
  });
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/";
  else render();
}
