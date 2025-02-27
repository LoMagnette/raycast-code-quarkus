import { Configuration } from "./models/Configuration";
import { BASE_URL } from "./api";
import AdmZip from "adm-zip";

import { exec } from "child_process";
import path from "path";
import { execSync } from "node:child_process";
import * as fs from "node:fs";

export type IDE = 'intellij' | 'vscode' | 'vscodium';

export function openInIDE(directoryPath : string, ide:IDE) {
  const normalizedPath = path.normalize(directoryPath);

  switch (ide.toLowerCase()) {
    case 'vscode':
      return openInClassicApp(normalizedPath, "Visual Studio Code");
    case 'vscodium':
      return openInClassicApp(normalizedPath, "VSCodium");
    case 'intellij':
      return openInIntellij(normalizedPath);
    default:
      throw new Error(`Unsupported IDE: ${ide}`);
  }
}

const openInClassicApp = (directoryPath:string, appName:string) =>{
  const command = `open -a "${appName}" "${directoryPath}"`;
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error opening ${appName}: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(` ${appName} stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

const openInIntellij = (directoryPath:string)=> {
  // Normalize the path
  const normalizedPath = path.normalize(directoryPath);

  return new Promise((resolve, reject) => {
      // Try multiple possible IntelliJ app names
      const possibleNames = [
        "IntelliJ IDEA.app",
        "IntelliJ IDEA Ultimate.app",
        "IntelliJ IDEA CE.app",
        "JetBrains Toolbox/IntelliJ IDEA Ultimate.app",
        "JetBrains Toolbox/IntelliJ IDEA.app"
      ];

      // Check Applications directory for JetBrains apps
      try {
        const appDirContents = fs.readdirSync('/Applications');
        const jetBrainsApps = appDirContents.filter(name =>
          name.toLowerCase().includes('intellij') || name.toLowerCase().includes('jetbrains')
        );

        console.log("Found potential IntelliJ applications:", jetBrainsApps);

        // Add found apps to possible names
        possibleNames.push(...jetBrainsApps);
      } catch (err) {
        console.error("Error reading Applications directory:", err);
      }

      // Try opening with each possible name
      let opened = false;

      for (const appName of possibleNames) {
        try {
          console.log(`Trying to open with: ${appName}`);
          execSync(`open -a "${appName}" "${normalizedPath}"`);
          console.log(`Successfully opened with: ${appName}`);
          opened = true;
          break;
        } catch (error: unknown) {
          console.log(`Failed to open with ${appName}: ${(error as Error).message}`);
        }
      }

      if (opened) {
        resolve("Opened IntelliJ successfully");
      } else {
        // Fallback to the Toolbox CLI if available
        try {
          console.log("Trying JetBrains Toolbox CLI...");
          execSync(`/usr/local/bin/jetbrains-toolbox open "${normalizedPath}" --intellij`);
          resolve("Opened IntelliJ via Toolbox CLI");
        } catch (toolboxError) {
          console.error("Toolbox CLI attempt failed:", toolboxError);
          reject(new Error("Could not open IntelliJ with any known method"));
        }
      }

  });
}

export function unzipFile(zipFilePath:string, destinationDir:string) {
  try {
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(destinationDir, true);
    console.log('Extraction complete');
    return true;
  } catch (error) {
    console.error('Error extracting zip:', error);
    throw error;
  }
}

export function getParams(config: Configuration): URLSearchParams {
  const params = new URLSearchParams();

  // Add the required fields
  params.set("j", config.javaVersion);
  params.set("S", config.quarkusVersion);
  params.set("cn", "code.quarkus.io");

  // Add build tool
  params.set("b", config.buildTool);

  // Add group ID, artifact ID, and version if provided
  if (config.group) params.set("g", config.group);
  if (config.artifact) params.set("a", config.artifact);

  // Add starter code flag
  params.set("nc", config.starterCode ? "false" : "true");
  params.set("v", config.version);

  // Add dependencies
  if (config.dependencies) {
    config.dependencies.forEach((dependency) => {
      params.append("e", dependency);
    });
  }

  // Return the generated URL
  return params;
}

export function getCodeQuarkusUrl(config: Configuration): string {
  return `${BASE_URL}?${getParams(config).toString()}`;
}
