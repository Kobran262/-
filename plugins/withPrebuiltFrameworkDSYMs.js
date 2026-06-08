const { withXcodeProject } = require('@expo/config-plugins');

const PHASE_NAME = 'Generate Prebuilt Framework dSYMs';

const SHELL_SCRIPT = [
  'set -e',
  'generate_dsym() {',
  '  local name="$1"',
  '  local bin="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/${name}.framework/${name}"',
  '  local out="${DWARF_DSYM_FOLDER_PATH}/${name}.framework.dSYM"',
  '  if [ -f "$bin" ]; then',
  '    echo "Generating dSYM for ${name}..."',
  '    dsymutil "$bin" -o "$out"',
  '  fi',
  '}',
  'for fw in hermesvm React ReactNativeDependencies ZXingObjC; do',
  '  generate_dsym "$fw"',
  'done',
].join('\n');

function phaseExists(project) {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
  return Object.keys(phases).some((key) => key.endsWith('_comment') && phases[key] === PHASE_NAME);
}

function withPrebuiltFrameworkDSYMs(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;

    if (phaseExists(project)) {
      return cfg;
    }

    project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, project.getFirstTarget().uuid, {
      shellPath: '/bin/sh',
      shellScript: SHELL_SCRIPT,
    });

    return cfg;
  });
}

module.exports = withPrebuiltFrameworkDSYMs;
