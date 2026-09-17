const fs = require("fs");
const path = require("path");

let graphCache = null;
let graphCacheTimestamp = 0;
const GRAPH_CACHE_TTL = 10 * 60 * 1000;

function getCachedGraph() {
  if (graphCache && Date.now() - graphCacheTimestamp < GRAPH_CACHE_TTL) {
    return graphCache;
  }
  return null;
}

function invalidateGraphCache() {
  graphCache = null;
  graphCacheTimestamp = 0;
}

const BACKEND_ROOT = path.join(__dirname, "../../../..", "backend", "src");
const FRONTEND_ROOT = path.join(__dirname, "../../../..", "frontend", "src");

const NODE_TYPES = {
  FILE: "file",
  FUNCTION: "function",
  API_ENDPOINT: "api_endpoint",
  COMPONENT: "component",
  HOOK: "hook",
  SERVICE: "service",
  MIDDLEWARE: "middleware",
  CONTROLLER: "controller",
  ROUTE: "route",
};

const EDGE_TYPES = {
  IMPORTS: "imports",
  CALLS: "calls",
  EXPORTS: "exports",
  USES: "uses",
  DEFINES: "defines",
  MOUNTS: "mounts",
};

function scanDirectory(dir, extensions = [".js", ".jsx", ".ts", ".tsx"]) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes("node_modules") && !entry.name.includes(".git")) {
      files.push(...scanDirectory(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractImports(content, filePath) {
  const imports = [];
  const requireRegex = /require\(["']([^"']+)["']\)/g;
  const importRegex = /import\s+(?:.*?\s+from\s+)?["']([^"']+)["']/g;

  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function extractExports(content) {
  const exports = [];
  const exportRegex = /module\.exports\s*=\s*\{([^}]+)\}|exports\.(\w+)|export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;

  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    if (match[1]) {
      match[1].split(",").forEach((name) => {
        const trimmed = name.trim().split(":")[0].trim();
        if (trimmed) exports.push(trimmed);
      });
    } else if (match[2]) {
      exports.push(match[2]);
    } else if (match[3]) {
      exports.push(match[3]);
    }
  }
  return exports;
}

function extractFunctions(content) {
  const functions = [];
  const funcRegex = /(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/g;

  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    functions.push(match[1] || match[2] || match[3]);
  }
  return [...new Set(functions)];
}

function extractApiEndpoints(content) {
  const endpoints = [];
  const endpointRegex = /router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;

  let match;
  while ((match = endpointRegex.exec(content)) !== null) {
    endpoints.push({ method: match[1].toUpperCase(), path: match[2] });
  }
  return endpoints;
}

function extractFunctionCalls(content) {
  const calls = [];
  const callRegex = /(?:await\s+)?(\w+(?:\.\w+)*)\s*\(/g;

  let match;
  while ((match = callRegex.exec(content)) !== null) {
    const call = match[1];
    if (!["if", "for", "while", "switch", "catch", "return", "throw", "new", "typeof", "instanceof"].includes(call)) {
      calls.push(call);
    }
  }
  return [...new Set(calls)];
}

function resolveImportPath(importPath, currentFile) {
  if (importPath.startsWith(".")) {
    const dir = path.dirname(currentFile);
    let resolved = path.resolve(dir, importPath);
    if (!fs.existsSync(resolved)) {
      for (const ext of [".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx"]) {
        if (fs.existsSync(resolved + ext)) {
          resolved = resolved + ext;
          break;
        }
      }
    }
    return resolved;
  }
  return null;
}

function buildDependencyGraph() {
  const cached = getCachedGraph();
  if (cached) return cached;

  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const backendFiles = scanDirectory(BACKEND_ROOT);
  const frontendFiles = scanDirectory(FRONTEND_ROOT);
  const allFiles = [...backendFiles, ...frontendFiles];

  for (const filePath of allFiles) {
    const relativePath = path.relative(path.join(__dirname, "../../../.."), filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath);

    let nodeType = NODE_TYPES.FILE;
    if (filePath.includes("/controllers/")) nodeType = NODE_TYPES.CONTROLLER;
    else if (filePath.includes("/services/")) nodeType = NODE_TYPES.SERVICE;
    else if (filePath.includes("/middleware/")) nodeType = NODE_TYPES.MIDDLEWARE;
    else if (filePath.includes("/routes/")) nodeType = NODE_TYPES.ROUTE;
    else if (filePath.includes("/hooks/")) nodeType = NODE_TYPES.HOOK;
    else if (filePath.includes("/components/")) nodeType = NODE_TYPES.COMPONENT;
    else if (filePath.includes("/pages/")) nodeType = NODE_TYPES.COMPONENT;

    const nodeId = relativePath;
    const nodeData = {
      id: nodeId,
      label: fileName,
      type: nodeType,
      path: relativePath,
      exports: extractExports(content),
      functions: extractFunctions(content),
      endpoints: extractApiEndpoints(content),
    };

    nodeMap.set(nodeId, nodeData);
    nodes.push(nodeData);

    const imports = extractImports(content, filePath);
    for (const importPath of imports) {
      const resolvedPath = resolveImportPath(importPath, filePath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        const targetRelative = path.relative(path.join(__dirname, "../../../.."), resolvedPath);
        edges.push({
          source: nodeId,
          target: targetRelative,
          type: EDGE_TYPES.IMPORTS,
        });
      }
    }

    const calls = extractFunctionCalls(content);
    for (const call of calls) {
      for (const [targetId, targetNode] of nodeMap) {
        if (targetId !== nodeId && targetNode.exports.includes(call)) {
          edges.push({
            source: nodeId,
            target: targetId,
            type: EDGE_TYPES.CALLS,
            label: call,
          });
        }
      }
    }
  }

  const routeFiles = allFiles.filter((f) => f.includes("/routes/"));
  for (const routeFile of routeFiles) {
    const routeContent = fs.readFileSync(routeFile, "utf-8");
    const routeRelative = path.relative(path.join(__dirname, "../../../.."), routeFile);

    const controllerRegex = /require\(["']\.\.\/controllers\/(\w+)["']\)/g;
    let match;
    while ((match = controllerRegex.exec(routeContent)) !== null) {
      const controllerName = match[1];
      const controllerFile = path.join(path.dirname(routeFile), "../controllers", controllerName + ".js");
      if (fs.existsSync(controllerFile)) {
        const controllerRelative = path.relative(path.join(__dirname, "../../../.."), controllerFile);
        edges.push({
          source: routeRelative,
          target: controllerRelative,
          type: EDGE_TYPES.CALLS,
          label: "uses controller",
        });
      }
    }
  }

  const indexFiles = allFiles.filter((f) => path.basename(f) === "index.js" && f.includes("/src/index"));
  for (const indexFile of indexFiles) {
    const indexContent = fs.readFileSync(indexFile, "utf-8");
    const indexRelative = path.relative(path.join(__dirname, "../../../.."), indexFile);

    const routeMountRegex = /app\.use\(["']\/api\/(\w+)["']\s*,\s*(\w+)Routes\)/g;
    let match;
    while ((match = routeMountRegex.exec(indexContent)) !== null) {
      const routeName = match[2].toLowerCase();
      const routeFile = path.join(path.dirname(indexFile), "routes", routeName + ".js");
      if (fs.existsSync(routeFile)) {
        const routeRelative = path.relative(path.join(__dirname, "../../../.."), routeFile);
        edges.push({
          source: indexRelative,
          target: routeRelative,
          type: EDGE_TYPES.MOUNTS,
          label: `/api/${match[1]}`,
        });
      }
    }
  }

  const result = { nodes, edges };
  graphCache = result;
  graphCacheTimestamp = Date.now();
  return result;
}

function getGraphStats(graph) {
  const nodeTypes = {};
  const edgeTypes = {};

  for (const node of graph.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }
  for (const edge of graph.edges) {
    edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
  }

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    nodeTypes,
    edgeTypes,
  };
}

module.exports = { buildDependencyGraph, getGraphStats, invalidateGraphCache, NODE_TYPES, EDGE_TYPES };
