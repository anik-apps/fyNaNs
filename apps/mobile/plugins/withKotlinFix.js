const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withKotlinFix(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // Patch gradle.properties to set Kotlin 1.9.25
      const gradlePropsPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle.properties"
      );
      let gradleProps = fs.readFileSync(gradlePropsPath, "utf-8");
      if (!gradleProps.includes("kotlinVersion=")) {
        gradleProps += "\nkotlinVersion=1.9.25\n";
      } else {
        gradleProps = gradleProps.replace(
          /kotlinVersion=.*/,
          "kotlinVersion=1.9.25"
        );
      }
      fs.writeFileSync(gradlePropsPath, gradleProps);

      // Patch the root build.gradle to add suppressKotlinVersionCompatibilityCheck
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        "build.gradle"
      );
      let buildGradle = fs.readFileSync(buildGradlePath, "utf-8");

      // Add allprojects block to suppress Kotlin version check in Compose
      if (!buildGradle.includes("suppressKotlinVersionCompatibilityCheck")) {
        const snippet = `
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += ["-P", "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=1.9.24"]
        }
    }
}
`;
        buildGradle += snippet;
      }
      fs.writeFileSync(buildGradlePath, buildGradle);

      return config;
    },
  ]);
};
