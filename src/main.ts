import { installHudRespawnLabelFix } from "./ui/hudRespawnLabelFix";
import { App } from "./app/App";
import { installCollectibleBanner } from "./ui/celebrationBanner";
import { installRespawnHintRuntimePatch } from "./ui/respawnHintRuntimePatch";
import { installRespawnHudLabel } from "./ui/respawnHudLabel";

const app = new App();
installHudRespawnLabelFix();
installRespawnHudLabel();
installRespawnHintRuntimePatch();

// start the HUD watcher that shows the banner at 70/83
installCollectibleBanner();

app.init().catch((err) => {
  console.error(err);
  alert(String(err));
});

