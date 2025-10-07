import { build } from "vite";

async function runBuild() {
  try {
    await build({
      configFile: "./vite.config.js" // 必要なら指定
    });
    console.log("Vite ビルド完了 ✅");
  } catch (err) {
    console.error("Vite ビルド中にエラー:", err);
    process.exit(1);
  }
}

runBuild();
