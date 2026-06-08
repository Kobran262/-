const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SWIFT_FIX = `
    # Workaround Swift 6 strict concurrency crashes (Xcode 26.x)
    installer.pods_project.targets.each do |target|
      if ['ExpoModulesCore', 'ExpoModulesJSI'].include?(target.name)
        target.build_configurations.each do |build_config|
          build_config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
          build_config.build_settings['SWIFT_COMPILATION_MODE'] = 'singlefile'
        end
      end
    end
`;

function withSwiftConcurrencyFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('ExpoModulesJSI')) {
        contents = contents.replace(
          /(:ccache_enabled => ccache_enabled\?\(podfile_properties\),\s*\)\s*\n)(\s*end)/,
          `$1${SWIFT_FIX}$2`
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = withSwiftConcurrencyFix;
