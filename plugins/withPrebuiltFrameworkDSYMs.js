const { withXcodeProject } = require('@expo/config-plugins');

const PHASE_NAME = 'Generate Prebuilt Framework dSYMs';

const SHELL_SCRIPT = [
  'set -e',
  'FRAMEWORKS_DIR="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"',
  'if [ -d "$FRAMEWORKS_DIR" ]; then',
  '  for fw_path in "$FRAMEWORKS_DIR"/*.framework; do',
  '    [ -d "$fw_path" ] || continue',
  '    fw=$(basename "$fw_path" .framework)',
  '    bin="$fw_path/$fw"',
  '    out="${DWARF_DSYM_FOLDER_PATH}/${fw}.framework.dSYM"',
  '    if [ -f "$bin" ]; then',
  '      echo "Generating dSYM for ${fw}..."',
  '      dsymutil "$bin" -o "$out"',
  '    fi',
  '  done',
  'fi',
].join('\n');

function encodeShellScript(script) {
  return `"${script.replace(/"/g, '\\"')}"`;
}

function findPhaseKey(project) {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
  for (const key of Object.keys(phases)) {
    if (key.endsWith('_comment')) continue;
    const comment = phases[`${key}_comment`];
    const phase = phases[key];
    if (comment === PHASE_NAME || phase?.name?.includes(PHASE_NAME)) {
      return key;
    }
  }
  return null;
}

function withPrebuiltFrameworkDSYMs(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const existingKey = findPhaseKey(project);

    if (existingKey) {
      project.hash.project.objects.PBXShellScriptBuildPhase[existingKey].shellScript =
        encodeShellScript(SHELL_SCRIPT);
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
