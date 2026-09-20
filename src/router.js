import { homePage } from "./pages/home.js";
import { boostingPage } from "./games/boosting/game.js";
import { overfittingPage } from "./games/overfitting/game.js";
import { samplingPage } from "./games/sampling/game.js";
import { classifiersPage } from "./games/classifiers/game.js";
import { mlpPage } from "./games/mlp/game.js";
import { descentPage } from "./games/descent/game.js";
import { backpropPage } from "./games/backprop/game.js";
import { treePage } from "./games/tree/game.js";

const routes = {
  "": homePage,
  boosting: boostingPage,
  overfitting: overfittingPage,
  sampling: samplingPage,
  classifiers: classifiersPage,
  mlp: mlpPage,
  descent: descentPage,
  backprop: backpropPage,
  tree: treePage,
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

  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/";
  else render();
}
