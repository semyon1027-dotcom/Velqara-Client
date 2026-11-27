const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withMinecraftPackage(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const packageName = 'com.mojang.minecraftpe';
    const alreadyDeclared = manifest.queries.some((query) =>
      (query.package || []).some((entry) => entry.$?.['android:name'] === packageName)
    );
    if (!alreadyDeclared) {
      manifest.queries.push({
        package: [{ $: { 'android:name': packageName } }],
      });
    }
    return config;
  });
};
