const { buildDependencyGraph, getGraphStats: computeStats } = require("../services/graph");

let cachedGraph = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000;

const getGraph = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!cachedGraph || !cacheTimestamp || now - cacheTimestamp > CACHE_TTL) {
      cachedGraph = buildDependencyGraph();
      cacheTimestamp = now;
    }

    res.json({
      graph: cachedGraph,
      stats: computeStats(cachedGraph),
      cached: cacheTimestamp === now,
    });
  } catch (error) {
    next(error);
  }
};

const getGraphStats = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!cachedGraph || !cacheTimestamp || now - cacheTimestamp > CACHE_TTL) {
      cachedGraph = buildDependencyGraph();
      cacheTimestamp = now;
    }

    res.json(computeStats(cachedGraph));
  } catch (error) {
    next(error);
  }
};

const getNodeDetails = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const now = Date.now();

    if (!cachedGraph || !cacheTimestamp || now - cacheTimestamp > CACHE_TTL) {
      cachedGraph = buildDependencyGraph();
      cacheTimestamp = now;
    }

    const node = cachedGraph.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return res.status(404).json({ error: "Node not found" });
    }

    const incomingEdges = cachedGraph.edges.filter((e) => e.target === nodeId);
    const outgoingEdges = cachedGraph.edges.filter((e) => e.source === nodeId);

    res.json({
      node,
      dependencies: outgoingEdges.map((e) => ({
        target: e.target,
        type: e.type,
        label: e.label,
      })),
      dependents: incomingEdges.map((e) => ({
        source: e.source,
        type: e.type,
        label: e.label,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getGraph, getGraphStats, getNodeDetails };
