import fs from 'node:fs';
import path from 'node:path';
import { buildInlineClientScriptTag, buildInlineClientSource } from './client.js';

const PREPARE_MARKER_START = '/* WIOLETT_LIVE_BROWSER_DEBUG START */';
const PREPARE_MARKER_END = '/* WIOLETT_LIVE_BROWSER_DEBUG END */';
const HTML_MARKER_START = '<!-- WIOLETT_LIVE_BROWSER_DEBUG START -->';
const HTML_MARKER_END = '<!-- WIOLETT_LIVE_BROWSER_DEBUG END -->';

function exists(repoRoot, relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function findFirst(repoRoot, candidates) {
  return candidates.find((candidate) => exists(repoRoot, candidate)) ?? null;
}

function readPackageJson(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

export function detectInjectionPlan(repoRoot, wsOrigin) {
  const packageJson = readPackageJson(repoRoot);
  const viteConfig = findFirst(repoRoot, [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ]);
  const nextLayout = findFirst(repoRoot, ['app/layout.tsx', 'app/layout.jsx', 'pages/_app.tsx', 'pages/_app.jsx']);
  const reactEntry = findFirst(repoRoot, [
    'src/main.tsx',
    'src/main.jsx',
    'src/index.tsx',
    'src/index.jsx',
  ]);
  const htmlShell = findFirst(repoRoot, ['index.html', 'public/index.html']);

  if (viteConfig) {
    return buildViteShimPlan(viteConfig, wsOrigin);
  }

  if (nextLayout) {
    return buildSourcePatchPlan(nextLayout, wsOrigin, 'next-layout');
  }

  if (reactEntry) {
    return buildSourcePatchPlan(reactEntry, wsOrigin, 'react-entry');
  }

  if (htmlShell) {
    return buildHtmlPatchPlan(htmlShell, wsOrigin);
  }

  return {
    method: 'source_patch',
    framework: packageJson?.dependencies?.next ? 'next' : 'generic',
    reason: 'No supported dev-server shim target was found. Use a manual source patch in the app root.',
    cleanup_markers: {
      start: PREPARE_MARKER_START,
      end: PREPARE_MARKER_END,
    },
    target_files: [],
    instructions: [
      'Add the temporary live-browser-debug inline WebSocket client block near the frontend app entry.',
      'Reload the local dev app to attach the bridge session.',
      'Remove the block after debugging ends.',
    ],
    patch: buildInlineLoaderBlockForJsEntry(wsOrigin),
  };
}

function buildViteShimPlan(targetFile, wsOrigin) {
  const inlineScriptTag = buildInlineClientScriptTag(wsOrigin);
  const pluginSnippet = `
${PREPARE_MARKER_START}
function wiolettLiveBrowserDebug() {
  return {
    name: 'wiolett-live-browser-debug',
    transformIndexHtml(html) {
      const marker = '${HTML_MARKER_START}';
      if (html.includes(marker)) {
        return html;
      }
      const script = ${JSON.stringify(`${HTML_MARKER_START}\n${inlineScriptTag}\n${HTML_MARKER_END}`)};
      return html.replace('</head>', script + '</head>');
    },
  };
}
${PREPARE_MARKER_END}
`.trim();

  return {
    method: 'dev_server_shim',
    framework: 'vite',
    reason: 'A Vite config file is present, so the bridge can be injected at HTML-transform time without touching app runtime code first.',
    cleanup_markers: {
      start: PREPARE_MARKER_START,
      end: PREPARE_MARKER_END,
    },
    target_files: [targetFile],
    instructions: [
      `Patch ${targetFile} with a temporary Vite plugin that injects the inline live-browser-debug bridge client into served HTML.`,
      'Add the helper function below and include `wiolettLiveBrowserDebug()` in the `plugins` array for local debugging only.',
      'Remove the helper function and plugin entry after debugging ends.',
    ],
    patch: pluginSnippet,
  };
}

function buildSourcePatchPlan(targetFile, wsOrigin, framework) {
  return {
    method: 'source_patch',
    framework,
    reason: 'No supported dev-server shim target was found, so the fastest path is a temporary inline WebSocket client patch in the frontend app entry.',
    cleanup_markers: {
      start: PREPARE_MARKER_START,
      end: PREPARE_MARKER_END,
    },
    target_files: [targetFile],
    instructions: [
      `Patch ${targetFile} with the temporary inline WebSocket bridge block below.`,
      'Keep the block dev-only and wrapped in the exact cleanup markers.',
      'Remove the block after debugging ends.',
    ],
    patch: buildInlineLoaderBlockForJsEntry(wsOrigin),
  };
}

function buildHtmlPatchPlan(targetFile, wsOrigin) {
  return {
    method: 'source_patch',
    framework: 'html-shell',
    reason: 'A plain HTML entry shell is present, so a temporary inline WebSocket client block is the simplest fallback.',
    cleanup_markers: {
      start: HTML_MARKER_START,
      end: HTML_MARKER_END,
    },
    target_files: [targetFile],
    instructions: [
      `Patch ${targetFile} with the marked inline client block below inside <head>.`,
      'Remove the marked block after debugging ends.',
    ],
    patch: `${HTML_MARKER_START}\n${buildInlineClientScriptTag(wsOrigin)}\n${HTML_MARKER_END}`,
  };
}

function buildInlineLoaderBlockForJsEntry(wsOrigin) {
  return `
${PREPARE_MARKER_START}
if (typeof window !== 'undefined' && !window.__WIOLETT_LIVE_BROWSER_DEBUG_LOADER__) {
  window.__WIOLETT_LIVE_BROWSER_DEBUG_LOADER__ = true;
  ${buildInlineClientSource(wsOrigin)}
}
${PREPARE_MARKER_END}
`.trim();
}
