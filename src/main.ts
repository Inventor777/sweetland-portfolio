import { App } from "./app/App";

const app = new App();
app.init().catch((err) => {
  console.error(err);
  alert(String(err));
});
